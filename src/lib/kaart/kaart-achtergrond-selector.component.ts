import { animate, state, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";
import { Subscription as RxSubscription } from "rxjs/Subscription";

import { observeOnAngular } from "../util/observe-on-angular";
import { ofType } from "../util/operators";
import { forEach } from "../util/option";
import { KaartComponentBase } from "./kaart-component-base";
import { AchtergrondLaag } from "./kaart-elementen";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import {
  AchtergrondlagenGezetMsg,
  achtergrondlagenGezetWrapper,
  AchtergrondtitelGezetMsg,
  achtergrondtitelGezetWrapper,
  KaartInternalMsg,
  KaartInternalSubMsg,
  kaartLogOnlyWrapper,
  subscribedWrapper
} from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { kaartLogger } from "./log";
import { internalMsgSubscriptionCmdOperator } from "./subscription-helper";

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
  private subHelperSub: RxSubscription = new RxSubscription();
  private displayMode: DisplayMode = DisplayMode.SHOWING_STATUS;
  achtergrondTitel = "";

  backgroundTiles$: Observable<Array<AchtergrondLaag>> = Observable.empty();

  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();

  constructor(private readonly cdr: ChangeDetectorRef, zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    // Eerst er voor zorgen dat we een notificatie krijgen van nieuwe achtergrondlagen en het externe zetten van de achtergrondlaag
    this.subHelperSub.unsubscribe(); // voor de zekerheid
    this.subHelperSub = this.internalMessage$
      .lift(
        internalMsgSubscriptionCmdOperator(
          this.dispatcher,
          prt.AchtergrondlagenSubscription(achtergrondlagenGezetWrapper),
          prt.AchtergrondTitelSubscription(achtergrondtitelGezetWrapper)
        )
      )
      .subscribe(err => kaartLogger.error);

    // Dan subscriben op nieuwe achtergrondlagen en het externe zetten van de achtergrondlaag
    this.backgroundTiles$ = this.internalMessage$.pipe(
      ofType<AchtergrondlagenGezetMsg>("AchtergrondlagenGezet"),
      map(a => a.achtergrondlagen.toArray()),
      observeOnAngular(this.zone)
    );

    this.internalMessage$
      .pipe(
        ofType<AchtergrondtitelGezetMsg>("AchtergrondtitelGezet"), //
        map(a => a.titel),
        observeOnAngular(this.zone)
      )
      .subscribe(titel => {
        this.achtergrondTitel = titel;
        this.cdr.detectChanges(); // We zitten nochthans in observeOnAngular.
      });
  }

  ngOnDestroy() {
    this.subHelperSub.unsubscribe(); // Stop met luisteren op subscriptions
    super.ngOnDestroy();
  }

  kies(laag: AchtergrondLaag): void {
    if (this.displayMode === DisplayMode.SELECTING) {
      // We wachten een beetje met de lijst te laten samen klappen zodat de tile met de nieuwe achtergrondlaag
      // van stijl kan aangepast worden (gebeurt automagisch door Angular change detection) vooraleer het inklapeffect
      // in werking treedt. Dat ziet er iets beter uit omdat in het andere geval de tile abrupt verspringt na het
      // inklappen.
      this.displayMode = DisplayMode.SHOWING_STATUS;
      if (laag.titel !== this.achtergrondTitel) {
        this.dispatcher.dispatch(prt.KiesAchtergrondCmd(laag.titel, kaartLogOnlyWrapper));
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
}
