import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import { MatIconRegistry } from "@angular/material";
import { DomSanitizer } from "@angular/platform-browser";
import * as rx from "rxjs";
import { distinctUntilChanged, map, mapTo, share, tap } from "rxjs/operators";

import { encodeAsSvgUrl } from "../../util/url";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { TableModel } from "./table-model";
import { TableLayoutMode } from "./TableLayoutMode";

export const FeatureTabelUiSelector = "FeatureTabel";

interface TemplateData {
  readonly layout: string;
}

const settingsSvg =
  // tslint:disable-next-line: max-line-length
  '<svg version="1.2" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" overflow="visible" preserveAspectRatio="none" viewBox="0 0 24 24" width="24" height="24"><g><path xmlns:default="http://www.w3.org/2000/svg" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" style="fill: rgb(85, 85, 85);" vector-effect="non-scaling-stroke"/></g></svg>';

/**
 * Hier worden instellingen voor de tabellen voor alle lagen gedaan.
 */
@Component({
  selector: "awv-feature-tabel-settings",
  templateUrl: "./feature-tabel-settings.component.html",
  styleUrls: ["./feature-tabel-settings.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush // Omdat angular anders veel te veel change detection uitvoert
})
export class FeatureTabelSettingsComponent extends KaartChildComponentBase {
  public readonly laagTitels$: rx.Observable<string[]>;

  // Voor de child components (Op DOM niveau. Access via Angular injection).
  public readonly templateData$: rx.Observable<TemplateData>;

  constructor(
    kaart: KaartComponent,
    ngZone: NgZone,
    overzicht: FeatureTabelOverzichtComponent,
    domSanitize: DomSanitizer,
    matIconRegistry: MatIconRegistry
  ) {
    super(kaart, ngZone);

    matIconRegistry.addSvgIcon("settings", domSanitize.bypassSecurityTrustResourceUrl(encodeAsSvgUrl(settingsSvg)));

    this.templateData$ = overzicht.tableModel$.pipe(
      map(TableModel.layoutInstellingGetter.get),
      distinctUntilChanged(TableLayoutMode.eqTableLayoutMode.equals),
      map(mode => ({
        layout: mode
      })),
      share()
    );

    this.runInViewReady(
      rx
        .merge(
          this.actionFor$("makeCompact").pipe(mapTo(TableModel.setCompactLayout)),
          this.actionFor$("makeComfortable").pipe(mapTo(TableModel.setComfortableLayout))
        )
        .pipe(tap(overzicht.tableUpdater))
    );
  }
}
