import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { List } from "immutable";
import { Observable } from "rxjs/Observable";
import { combineLatest, filter, map, shareReplay, startWith } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { ToegevoegdeLaag } from "../kaart/kaart-elementen";
import { KaartInternalMsg, VoorgrondlagenGezetMsg, voorgrondlagenGezetMsgGen } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { ofType } from "../util/operators";

export const LagenUiSelector = "Lagenkiezer";

export interface LagenUiOpties {
  toonLegende: boolean;
}

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
  readonly opties$: Observable<LagenUiOpties>;

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
    this.opties$ = this.modelChanges.uiElementOpties$.pipe(
      filter(o => o.naam === LagenUiSelector),
      map(o => o.opties as LagenUiOpties),
      startWith({
        toonLegende: false
      }),
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
