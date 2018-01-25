import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from "@angular/core";
import { trigger, state, style, transition, animate } from "@angular/animations";
import { Observable } from "rxjs/Observable";
import { BehaviorSubject } from "rxjs/BehaviorSubject";

import { Laag, WmsLaag } from "./kaart-elementen";
import { combineLatest, map, filter, first, tap } from "rxjs/operators";
import { KaartWithInfo } from "./kaart-with-info";
import { InsertedLaag, RemovedLaag } from "./kaart-protocol-events";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartComponent } from "./kaart.component";
import { KaartClassicComponent } from "./kaart-classic.component";

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
export class KaartAchtergrondSelectorComponent extends KaartComponentBase implements OnInit {
  // component state is aanvaardbaar zolang de html view er niet direct aan komt
  private displayMode: DisplayMode = DisplayMode.SHOWING_STATUS;
  private achtergrondTitel = "";

  backgroundTiles$: Observable<WmsLaag[]> = Observable.empty();

  show = false;

  @Input() kaartModel$: Observable<KaartWithInfo>;

  constructor(private readonly kaart: KaartClassicComponent, private readonly cdr: ChangeDetectorRef, zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    // hackadihack -> er is een raceconditie in de change detection van Angular. Zonder wordt soms de selectiecomponent niet getoond.
    setTimeout(() => this.cdr.detectChanges(), 1000);
    this.runAsapOutsideAngular(() => {
      console.log("constructing achtergrond selector");
      this.kaartModel$
        .pipe(
          tap(m => console.log("voor map 0", m)),
          map(model => model.possibleBackgrounds),
          first(bgs => !bgs.isEmpty()), // De eerste keer dat er achtergronden gezet worden
          map(bgs => bgs.get(0).titel) // gebruiken we die om er de achtergrondtitel mee te initialiseren
        )
        .subscribe(titel => (this.achtergrondTitel = titel));
      this.backgroundTiles$ = this.kaartModel$.pipe(
        tap(m => console.log("Voor map", m)),
        map(model => model.possibleBackgrounds.toArray()),
        tap(ls => console.log("Na map", ls))
      );
      console.log("constructie gedaan", this.kaartModel$);
    });
  }

  kies(laag: WmsLaag): void {
    if (this.displayMode === DisplayMode.SELECTING) {
      // We wachten een beetje met de lijst te laten samen klappen zodat de tile met de nieuwe achtergrondlaag
      // van stijl kan aangepast worden (gebeurt automagisch door Angular change detection) vooraleer het inklapeffect
      // in werking treedt. Dat ziet er iets beter uit omdat in het andere geval de tile abrupt verspringt na het
      // inklappen.
      // setTimeout(() => (this.displayMode = DisplayMode.SHOWING_STATUS), 10);
      this.displayMode = DisplayMode.SHOWING_STATUS;
      if (laag.titel !== this.achtergrondTitel) {
        this.kaart.dispatch(new RemovedLaag(this.achtergrondTitel));
        this.kaart.dispatch(new InsertedLaag(0, laag));
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
        console.log(`laag: ${laag.titel}`, this.isCurrentlyBackground(laag) ? Visible : Invisible);
        return this.isCurrentlyBackground(laag) ? Visible : Invisible;
      }
      case DisplayMode.SELECTING: {
        console.log(`laag: ${laag.titel}`, "visible");
        return Visible;
      }
    }
  }
}
