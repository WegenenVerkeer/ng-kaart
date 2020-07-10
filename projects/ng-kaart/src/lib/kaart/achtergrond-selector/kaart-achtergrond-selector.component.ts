import { animate, state, style, transition, trigger } from "@angular/animations";
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnInit } from "@angular/core";
import * as rx from "rxjs";
import { map, switchMap, takeUntil } from "rxjs/operators";

import { ofType } from "../../util/operators";

import { KaartChildDirective } from "../kaart-child.directive";
import { mobile } from "../kaart-config";
import { AchtergrondLaag, ToegevoegdeLaag } from "../kaart-elementen";
import { AchtergrondtitelGezetMsg, achtergrondtitelGezetWrapper, KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

enum DisplayMode {
  SHOWING_STATUS,
  SELECTING
}

const Visible = "visible";
const Invisible = "invisible";

@Component({
  selector: "awv-kaart-achtergrond-selector",
  templateUrl: "./kaart-achtergrond-selector.component.html",
  styleUrls: ["./kaart-achtergrond-selector.component.scss"],
  animations: [
    trigger("visibility", [
      state(
        Visible,
        style({
          opacity: "1.0",
          maxWidth: "80px"
        })
      ),
      state(
        Invisible,
        style({
          opacity: "0.0",
          maxWidth: "0px",
          marginRight: "0px"
        })
      ),
      transition(Invisible + " => " + Visible, animate("0.2s cubic-bezier(.62,.28,.23,.99)")),
      transition(Visible + " => " + Invisible, animate("0.15s cubic-bezier(.62,.28,.23,.99)"))
    ]),
    trigger("popOverState", [
      state(
        "show",
        style({
          opacity: 1
        })
      ),
      state(
        "hide",
        style({
          opacity: 0
        })
      ),
      transition("show => hide", animate("600ms ease-out")),
      transition("hide => show", animate("1000ms ease-in"))
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush // Bij default is er een endless loop van updates
})
export class KaartAchtergrondSelectorComponent extends KaartChildDirective implements OnInit {
  public readonly DisplayMode = DisplayMode;
  public displayMode: DisplayMode = DisplayMode.SHOWING_STATUS;
  public achtergrondTitel = "";
  readonly onMobileDevice = mobile;
  handsetPortrait = false;

  readonly backgroundTiles$: rx.Observable<Array<ToegevoegdeLaag>> = rx.EMPTY;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    kaartComponent: KaartComponent,
    zone: NgZone,
    breakpointObserver: BreakpointObserver
  ) {
    super(kaartComponent, zone);

    this.backgroundTiles$ = this.initialising$.pipe(switchMap(() => this.modelChanges.lagenOpGroep.Achtergrond.pipe(map(lgn => lgn))));

    this.initialising$
      .pipe(
        switchMap(() =>
          this.internalMessage$.pipe(
            ofType<AchtergrondtitelGezetMsg>("AchtergrondtitelGezet"), //
            map(a => a.titel),
            takeUntil(this.destroying$)
          )
        )
      )
      .subscribe(titel => {
        this.achtergrondTitel = titel;
        this.cdr.detectChanges();
      });

    breakpointObserver.observe([Breakpoints.HandsetPortrait]).subscribe(result => {
      // Gebruik van built-in breakpoints uit de Material Design spec: https://material.angular.io/cdk/layout/overview
      this.handsetPortrait = result.matches && this.onMobileDevice;
      this.cdr.detectChanges();
    });
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.AchtergrondTitelSubscription(achtergrondtitelGezetWrapper)];
  }

  kies(laag?: AchtergrondLaag): void {
    if (this.displayMode === DisplayMode.SELECTING && laag) {
      // We wachten een beetje met de lijst te laten samen klappen zodat de tile met de nieuwe achtergrondlaag
      // van stijl kan aangepast worden (gebeurt automagisch door Angular change detection) vooraleer het inklapeffect
      // in werking treedt. Dat ziet er iets beter uit omdat in het andere geval de tile abrupt verspringt na het
      // inklappen.
      this.displayMode = DisplayMode.SHOWING_STATUS;
      if (laag.titel !== this.achtergrondTitel) {
        this.dispatch(prt.KiesAchtergrondCmd(laag.titel, kaartLogOnlyWrapper));
        this.achtergrondTitel = laag.titel;
      }
    } else {
      this.displayMode = DisplayMode.SELECTING;
    }
    this.cdr.detectChanges();
  }

  isCurrentlyBackground(laag: AchtergrondLaag): boolean {
    return laag.titel === this.achtergrondTitel;
  }

  tileVisibility(laag: AchtergrondLaag): string {
    switch (this.displayMode) {
      case DisplayMode.SHOWING_STATUS: {
        return this.isCurrentlyBackground(laag) ? Visible : Invisible;
      }
      case DisplayMode.SELECTING: {
        return Visible;
      }
    }
  }

  clickedOutside() {
    this.displayMode = DisplayMode.SHOWING_STATUS;
    this.cdr.detectChanges();
  }

  // De "close" en "open" methodes zijn enkel en alleen geintroduceerd voor de leesbaarheid in de HTML template.
  // Achterliggend moet, zoals duidelijk, enkel "kies" opgeroepen worden, deze bevat reeds alle nodige functionaliteit.
  close($event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.kies();
  }

  open() {
    this.kies();
  }
}
