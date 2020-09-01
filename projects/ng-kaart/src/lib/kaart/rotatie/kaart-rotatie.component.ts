import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { ChangeDetectorRef, Component, NgZone, OnInit } from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { option } from "fp-ts";
import * as rx from "rxjs";
import { delay, distinctUntilChanged, map, tap } from "rxjs/operators";

import { encodeAsSvgUrl } from "../../util/url";
import { KaartChildDirective } from "../kaart-child.directive";
import { mobile } from "../kaart-config";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

// https://materialdesignicons.com/icon/compass
const compassSVG =
  // eslint-disable-next-line max-len
  '<svg x="0px" y="0px" width="24px" height="24px" transform="rotate(-45)" viewBox="0 0 24 24"><path d="M14.19,14.19L6,18L9.81,9.81L18,6M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,10.9A1.1,1.1 0 0,0 10.9,12A1.1,1.1 0 0,0 12,13.1A1.1,1.1 0 0,0 13.1,12A1.1,1.1 0 0,0 12,10.9Z" /></svg>';

@Component({
  selector: "awv-kaart-rotatie",
  templateUrl: "./kaart-rotatie.component.html",
  styleUrls: ["./kaart-rotatie.component.scss"],
})
export class KaartRotatieComponent
  extends KaartChildDirective
  implements OnInit {
  readonly rotatie$: rx.Observable<number>;
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly clickBtnSubj: rx.Subject<boolean> = new rx.Subject<boolean>();

  readonly onMobileDevice = mobile;
  handsetPortrait = false;

  constructor(
    private readonly parent: KaartComponent,
    zone: NgZone,
    matIconRegistry: MatIconRegistry,
    domSanitize: DomSanitizer,
    changeDector: ChangeDetectorRef,
    breakpointObserver: BreakpointObserver
  ) {
    super(parent, zone);
    breakpointObserver
      .observe([Breakpoints.HandsetPortrait])
      .subscribe((result) => {
        // Gebruik van built-in breakpoints uit de Material Design spec: https://material.angular.io/cdk/layout/overview
        this.handsetPortrait = result.matches && this.onMobileDevice;
      });

    matIconRegistry.addSvgIcon(
      "compass",
      domSanitize.bypassSecurityTrustResourceUrl(encodeAsSvgUrl(compassSVG))
    );

    this.rotatie$ = this.parent.modelChanges.rotatie$.pipe(
      distinctUntilChanged(),
      tap(() => changeDector.detectChanges()) // force redraw rotated compass, anders wordt die niet dynamisch getekend
    );

    this.zichtbaar$ = rx.merge(
      rx.of(false), // kompas initieel niet zichtbaar
      this.rotatie$.pipe(map((hoek) => hoek !== 0)), // tot de kaart gedraaid wordt, tenzij terug naar noorden draaien (via snapping)
      this.bindToLifeCycle(this.clickBtnSubj).pipe(delay(1000)) // en terug onzichtbaar 1 seconde na gebruiker klik op knop
    );
  }

  roteerNaarNoord() {
    this.dispatch(prt.VeranderRotatieCmd(0, option.some(250)));
    this.clickBtnSubj.next(false);
  }
}
