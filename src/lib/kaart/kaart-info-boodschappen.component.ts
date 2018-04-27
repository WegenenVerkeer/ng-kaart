import { animate, state, style, transition, trigger } from "@angular/animations";
import { Component, EventEmitter, NgZone, OnInit, Output } from "@angular/core";
import { List } from "immutable";

import { observeOnAngular } from "../util/observe-on-angular";
import { ofType } from "../util/operators";
import { InfoBoodschap } from "./kaart-with-info-model";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { InfoBoodschappenMsg, infoBoodschappenMsgGen, KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";

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
  ]
})
export class KaartInfoBoodschappenComponent extends KaartChildComponentBase implements OnInit {
  @Output() infoBoodschappen$: EventEmitter<List<InfoBoodschap>> = new EventEmitter();

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.InfoBoodschappenSubscription(infoBoodschappenMsgGen)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.internalMessage$
      .pipe(
        ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
        observeOnAngular(this.zone)
      )
      .subscribe(msg => {
        this.infoBoodschappen$.emit(msg.infoBoodschappen.reverse().toList()); // laatste boodschap bovenaan tonen
      });
  }
}
