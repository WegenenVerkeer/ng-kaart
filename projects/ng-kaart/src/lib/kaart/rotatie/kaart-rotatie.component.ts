import { ChangeDetectorRef, Component, NgZone, OnInit } from "@angular/core";
import { MatIconRegistry } from "@angular/material";
import { DomSanitizer } from "@angular/platform-browser";
import { some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { delay, distinctUntilChanged, map, tap } from "rxjs/operators";

import { encodeAsSvgUrl } from "../../util/url";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

// https://materialdesignicons.com/icon/compass
const compassSVG =
  // tslint:disable-next-line:max-line-length
  '<svg x="0px" y="0px" width="24px" height="24px" transform="rotate(-45)" viewBox="0 0 24 24"><path d="M14.19,14.19L6,18L9.81,9.81L18,6M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,10.9A1.1,1.1 0 0,0 10.9,12A1.1,1.1 0 0,0 12,13.1A1.1,1.1 0 0,0 13.1,12A1.1,1.1 0 0,0 12,10.9Z" /></svg>';

@Component({
  selector: "awv-kaart-rotatie",
  templateUrl: "./kaart-rotatie.component.html",
  styleUrls: ["./kaart-rotatie.component.scss"]
})
export class KaartRotatieComponent extends KaartChildComponentBase implements OnInit {
  readonly rotatie$: rx.Observable<number>;
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly clickBtnSubj: rx.Subject<boolean> = new rx.Subject<boolean>();

  constructor(
    private readonly parent: KaartComponent,
    zone: NgZone,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitize: DomSanitizer,
    private readonly changeDector: ChangeDetectorRef
  ) {
    super(parent, zone);

    this.matIconRegistry.addSvgIcon("compass", this.domSanitize.bypassSecurityTrustResourceUrl(encodeAsSvgUrl(compassSVG)));

    this.rotatie$ = this.parent.modelChanges.rotatie$.pipe(
      distinctUntilChanged(),
      tap(() => this.changeDector.detectChanges()) // force redraw rotated compass, anders wordt die niet dynamisch getekend
    );

    this.zichtbaar$ = rx.merge(
      rx.of(false), // kompas initieel niet zichtbaar
      this.rotatie$.pipe(map(() => true)), // tot de kaart gedraaid wordt
      this.bindToLifeCycle(this.clickBtnSubj).pipe(delay(2000)) // en terug onzichtbaar 2 seconden na gebruiker klik op knop
    );
  }

  roteerNaarNoord() {
    this.dispatch(prt.VeranderRotatieCmd(0, some(250)));
    this.clickBtnSubj.next(false);
  }
}
