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
import { switchMap, filter, map, tap, combineLatest, startWith } from "rxjs/operators";
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
  readonly lagenHoog$: Observable<List<ToegevoegdeLaag>>;
  readonly lagenLaag$: Observable<List<ToegevoegdeLaag>>;
  readonly heeftDivider$: Observable<boolean>;
  readonly geenLagen$: Observable<boolean>;

  constructor(parent: KaartComponent, ngZone: NgZone) {
    super(parent, ngZone);

    const voorgrondLagen$ = this.internalMessage$.pipe(ofType<VoorgrondlagenGezetMsg>("VoorgrondlagenGezet"));
    this.lagenHoog$ = voorgrondLagen$.pipe(filter(m => m.groep === "Voorgrond.Hoog"), map(m => m.lagen));
    this.lagenLaag$ = voorgrondLagen$.pipe(filter(m => m.groep === "Voorgrond.Laag"), map(m => m.lagen));
    this.heeftDivider$ = this.lagenHoog$.pipe(combineLatest(this.lagenLaag$, (h, l) => !(h.isEmpty() || l.isEmpty())), startWith(false));
    this.geenLagen$ = this.lagenHoog$.pipe(combineLatest(this.lagenLaag$, (h, l) => h.isEmpty() && l.isEmpty()), startWith(true));
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [
      prt.LagenInGroepSubscription("Voorgrond.Hoog", voorgrondlagenGezetMsgGen("Voorgrond.Hoog")),
      prt.LagenInGroepSubscription("Voorgrond.Laag", voorgrondlagenGezetMsgGen("Voorgrond.Laag"))
    ];
  }
}
