import { animate, state, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, Component, NgZone } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { and, not } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { debounceTime, filter, map, startWith, withLatestFrom } from "rxjs/operators";

import * as maps from "../../util/maps";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { InfoBoodschappenMsg, infoBoodschappenMsgGen, KaartInternalMsg } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { InfoBoodschap } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

export interface KaartInfoBoodschapOpties {
  readonly kaartBevragenOnderdrukt: boolean;
}

export const KaartInfoBoodschapUiSelector = "KaartInfoBoodschap";

const defaultOpties: KaartInfoBoodschapOpties = {
  kaartBevragenOnderdrukt: false
};

@Component({
  selector: "awv-kaart-info-boodschappen",
  templateUrl: "./kaart-info-boodschappen.component.html",
  styleUrls: ["./kaart-info-boodschappen.component.scss"],
  animations: [
    trigger("fadeIn", [
      state("visible", style({ opacity: 1 })),
      transition(":enter", [style({ opacity: 0 }), animate(200)]),
      transition(":leave", animate(0, style({ opacity: 0 })))
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KaartInfoBoodschappenComponent extends KaartChildComponentBase {
  infoBoodschappen$: rx.Observable<Array<InfoBoodschap>> = rx.EMPTY;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    const kaartBevragenOnderdrukt$: rx.Observable<boolean> = this.modelChanges.uiElementOpties$.pipe(
      filter(opties => opties.naam === KaartInfoBoodschapUiSelector),
      map(opties => opties.opties as KaartInfoBoodschapOpties),
      startWith(defaultOpties),
      map(kibo => kibo.kaartBevragenOnderdrukt)
    );

    const identifyOnderdrukt$: rx.Observable<boolean> = this.modelChanges.tabelState$.pipe(map(change => change.state === "Opengeklapt"));

    const infoBoodschappen$ = this.internalMessage$.pipe(
      ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
      observeOnAngular(this.zone),
      map(msg => Array.from(maps.reverse(msg.infoBoodschappen).values())), // laatste boodschap bovenaan
      debounceTime(250) // omdat we requests in parallel afvuren, komen er vaak updates dicht tegen elkaar
    );

    const filteredInfoboodschappen = infoBoodschappen$.pipe(
      withLatestFrom(kaartBevragenOnderdrukt$, identifyOnderdrukt$),
      map(([boodschappen, kaartBevragenOnderdrukt, identifyOnderdrukt]) =>
        array.filter(
          boodschappen,
          and(
            not(boodschap => boodschap.type === "InfoBoodschapKaartBevragen" && kaartBevragenOnderdrukt),
            not(boodschap => boodschap.type === "InfoBoodschapIdentify" && identifyOnderdrukt)
          )
        )
      )
    );

    this.infoBoodschappen$ = filteredInfoboodschappen;
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.InfoBoodschappenSubscription(infoBoodschappenMsgGen)];
  }
}
