import {
  animate,
  state,
  style,
  transition,
  trigger,
} from "@angular/animations";
import { Component, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { debounceTime, map } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { KaartChildDirective } from "../kaart-child.directive";
import {
  InfoBoodschappenMsg,
  infoBoodschappenMsgGen,
  KaartInternalMsg,
} from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { InfoBoodschap } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

@Component({
  selector: "awv-kaart-info-boodschappen",
  templateUrl: "./kaart-info-boodschappen.component.html",
  styleUrls: ["./kaart-info-boodschappen.component.scss"],
  animations: [
    trigger("fadeIn", [
      state("visible", style({ opacity: 1 })),
      transition(":enter", [style({ opacity: 0 }), animate(200)]),
      transition(":leave", animate(0, style({ opacity: 0 }))),
    ]),
  ],
})
export class KaartInfoBoodschappenComponent extends KaartChildDirective {
  infoBoodschappen$: rx.Observable<Array<InfoBoodschap>> = rx.EMPTY;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    const infoBoodschappen$ = this.internalMessage$.pipe(
      ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
      observeOnAngular(this.zone),
      map((msg) => Array.from(msg.infoBoodschappen.values()).reverse()), // laatste boodschap bovenaan
      debounceTime(250) // omdat we requests in parallel afvuren, komen er vaak updates dicht tegen elkaar
    );

    this.infoBoodschappen$ = infoBoodschappen$;
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.InfoBoodschappenSubscription(infoBoodschappenMsgGen)];
  }
}
