import { ChangeDetectionStrategy, Component, Input, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { distinctUntilChanged, map, mapTo, share, switchMap, tap } from "rxjs/operators";

import { collectOption, subSpy } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as cmd from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";

import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { TableHeader, TableModel } from "./model";

@Component({
  selector: "awv-feature-tabel-header",
  templateUrl: "./feature-tabel-header.component.html",
  styleUrls: ["./feature-tabel-header.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelHeaderComponent extends KaartChildComponentBase {
  header$: rx.Observable<TableHeader>;

  @Input()
  laagTitel: string;

  constructor(kaart: KaartComponent, overzicht: FeatureTabelOverzichtComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    const model$ = overzicht.model$;

    const laag$ = this.viewReady$.pipe(
      // De input is pas beschikbaar nadat de view klaar is
      switchMap(() =>
        model$.pipe(
          collectOption(TableModel.laagForTitel(this.laagTitel)),
          share()
        )
      )
    );

    this.header$ = subSpy("****header$")(
      laag$.pipe(
        map(TableHeader.toHeader),
        distinctUntilChanged(TableHeader.setoidTableHeader.equals),
        share()
      )
    );

    const toggleActivityCmd$ = this.header$.pipe(
      switchMap(header =>
        this.actionFor$("toggleFilterActive").pipe(mapTo(cmd.ActiveerFilter(header.titel, !header.filterIsActive, kaartLogOnlyWrapper)))
      )
    );

    this.runInViewReady(toggleActivityCmd$.pipe(tap(cmd => this.dispatch(cmd))));
  }
}
