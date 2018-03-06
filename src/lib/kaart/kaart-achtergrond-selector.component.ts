import { Component, OnInit, Input, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, OnDestroy } from "@angular/core";
import { trigger, state, style, transition, animate } from "@angular/animations";
import { Observable } from "rxjs/Observable";

import { WmsLaag, BlancoLaag } from "./kaart-elementen";
import { map, first } from "rxjs/operators";
import { KaartWithInfo } from "./kaart-with-info";
import { KiesAchtergrond } from "./kaart-protocol-events";
import { KaartComponentBase } from "./kaart-component-base";
import { VacuousDispatcher, KaartEventDispatcher } from "./kaart-event-dispatcher";

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
          maxWidth: "100px",
          marginRight: "12px"
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
      transition(Invisible + " => " + Visible, animate("200ms ease-in")),
      transition(Visible + " => " + Invisible, animate("150ms ease-in"))
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
export class KaartAchtergrondSelectorComponent extends KaartComponentBase implements OnInit, OnDestroy {
  // component state is aanvaardbaar zolang de html view er niet direct aan komt
  private displayMode: DisplayMode = DisplayMode.SHOWING_STATUS;
  private achtergrondTitel = "";

  backgroundTiles$: Observable<Array<WmsLaag | BlancoLaag>> = Observable.empty();

  show = false;

  @Input() kaartModel$: Observable<KaartWithInfo> = Observable.never();
  @Input() dispatcher: KaartEventDispatcher = VacuousDispatcher;

  constructor(private readonly cdr: ChangeDetectorRef, zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    // hackadihack -> er is een raceconditie in de change detection van Angular. Zonder wordt soms de selectiecomponent niet getoond.
    setTimeout(() => this.cdr.detectChanges(), 1000);
    this.runAsapOutsideAngular(() => {
      this.kaartModel$
        .pipe(
          map(model => model.possibleBackgrounds),
          first(bgs => !bgs.isEmpty()), // De eerste keer dat er achtergronden gezet worden
          map(bgs => bgs.get(0).titel) // gebruiken we die om er de achtergrondtitel mee te initialiseren
        )
        .subscribe(titel => (this.achtergrondTitel = titel));
      this.backgroundTiles$ = this.kaartModel$.pipe(
        map(model => model.possibleBackgrounds.toArray()) //
      );
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  kies(laag: WmsLaag): void {
    if (this.displayMode === DisplayMode.SELECTING) {
      // We wachten een beetje met de lijst te laten samen klappen zodat de tile met de nieuwe achtergrondlaag
      // van stijl kan aangepast worden (gebeurt automagisch door Angular change detection) vooraleer het inklapeffect
      // in werking treedt. Dat ziet er iets beter uit omdat in het andere geval de tile abrupt verspringt na het
      // inklappen.
      this.displayMode = DisplayMode.SHOWING_STATUS;
      if (laag.titel !== this.achtergrondTitel) {
        this.dispatcher.dispatch(new KiesAchtergrond(laag.titel));
        this.achtergrondTitel = laag.titel;
      }
    } else {
      this.displayMode = DisplayMode.SELECTING;
    }
    this.cdr.detectChanges();
  }

  isCurrentlyBackground(laag: WmsLaag): boolean {
    return laag.titel === this.achtergrondTitel;
  }

  tileVisibility(laag: WmsLaag): string {
    switch (this.displayMode) {
      case DisplayMode.SHOWING_STATUS: {
        return this.isCurrentlyBackground(laag) ? Visible : Invisible;
      }
      case DisplayMode.SELECTING: {
        return Visible;
      }
    }
  }
}
