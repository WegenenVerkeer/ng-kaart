import { Component, OnInit, OnDestroy, NgZone } from "@angular/core";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";
import * as prt from "../kaart/kaart-protocol";
import {
  AchtergrondlagenGezetMsg,
  AchtergrondtitelGezetMsg,
  achtergrondtitelGezetWrapper,
  KaartInternalMsg,
  kaartLogOnlyWrapper,
  voorgrondlagenGezetMsgGen,
  VoorgrondlagenGezetMsg
} from "../kaart/kaart-internal-messages";
import { switchMap, filter, map, tap, combineLatest, startWith, shareReplay } from "rxjs/operators";
import { ofType } from "../util/operators";
import { Observable } from "rxjs/Observable";
import { List } from "immutable";
import { Laag, ToegevoegdeLaag } from "../kaart/kaart-elementen";
import * as rx from "rxjs";

export const LagenUISelector = "Lagenkiezer";

@Component({
  selector: "awv-lagenkiezer",
  templateUrl: "./lagenkiezer.component.html",
  styleUrls: ["lagenkiezer.component.scss"]
})
export class LagenkiezerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private compact = false;
  readonly lagenHoog$: Observable<List<ToegevoegdeLaag>>;
  readonly lagenLaag$: Observable<List<ToegevoegdeLaag>>;
  readonly heeftDivider$: Observable<boolean>;
  readonly geenLagen$: Observable<boolean>;

  constructor(parent: KaartComponent, ngZone: NgZone) {
    super(parent, ngZone);

    const voorgrondLagen$ = this.internalMessage$.pipe(ofType<VoorgrondlagenGezetMsg>("VoorgrondlagenGezet"));
    this.lagenHoog$ = voorgrondLagen$.pipe(
      filter(m => m.groep === "Voorgrond.Hoog"),
      map(m => m.lagen),
      shareReplay(1) // Omdat observable in ngIf zit, moeten we de laatste toestand cachen
    );
    this.lagenLaag$ = voorgrondLagen$.pipe(
      filter(m => m.groep === "Voorgrond.Laag"),
      map(m => m.lagen),
      shareReplay(1) //
    );
    this.heeftDivider$ = this.lagenHoog$.pipe(
      combineLatest(this.lagenLaag$, (h, l) => !(h.isEmpty() || l.isEmpty())),
      startWith(false),
      shareReplay(1)
    );
    this.geenLagen$ = this.lagenHoog$.pipe(
      combineLatest(this.lagenLaag$, (h, l) => h.isEmpty() && l.isEmpty()),
      startWith(true),
      shareReplay(1)
    );
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [
      prt.LagenInGroepSubscription("Voorgrond.Hoog", voorgrondlagenGezetMsgGen("Voorgrond.Hoog")),
      prt.LagenInGroepSubscription("Voorgrond.Laag", voorgrondlagenGezetMsgGen("Voorgrond.Laag"))
    ];
  }

  get uitgeklapt() {
    return !this.compact;
  }

  get ingeklapt() {
    return this.compact;
  }

  verbergLijst() {
    this.compact = true;
  }

  toonLijst() {
    this.compact = false;
  }
}
