import { Component, OnInit, OnDestroy, NgZone } from "@angular/core";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";
import * as prt from "../kaart/kaart-protocol";
import {
  AchtergrondlagenGezetMsg,
  achtergrondlagenGezetWrapper,
  AchtergrondtitelGezetMsg,
  achtergrondtitelGezetWrapper,
  KaartInternalMsg,
  kaartLogOnlyWrapper
} from "../kaart/kaart-internal-messages";

@Component({
  selector: "awv-lagenkiezer",
  templateUrl: "./lagenkiezer.component.html",
  styleUrls: ["lagenkiezer.component.scss"]
})
export class LagenkiezerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  constructor(parent: KaartComponent, ngZone: NgZone) {
    super(parent, ngZone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [
      prt.LagenInGroepSubscription("Achtergrond", achtergrondlagenGezetWrapper), //
      prt.AchtergrondTitelSubscription(achtergrondtitelGezetWrapper)
    ];
  }
}
