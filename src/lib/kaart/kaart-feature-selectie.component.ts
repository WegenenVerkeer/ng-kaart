import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  EventEmitter,
  Output,
  Input,
  SimpleChanges,
  OnChanges
} from "@angular/core";

import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";

import { ofType } from "../util/operators";
import { KaartChildComponentBase } from "./kaart-child-component-base";

import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { KaartComponent } from "./kaart.component";

import { List } from "immutable";
import { FeatureSelectieAangepastMsg, featureSelectieAangepastMsgWrapper, KaartInternalMsg } from "./kaart-internal-messages";
import { SelectieModus } from "./kaart-protocol-commands";

@Component({
  selector: "awv-kaart-feature-selectie",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartFeatureSelectieComponent extends KaartChildComponentBase implements OnInit, OnDestroy, OnChanges {
  @Input() selectieModus: SelectieModus = "none";

  @Output() geselecteerdeFeatures: EventEmitter<List<ol.Feature>> = new EventEmitter<List<ol.Feature>>();

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.GeselecteerdeFeaturesSubscription(featureSelectieAangepastMsgWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    // const kaartObs: Observable<KaartWithInfo> = this.kaartComponent.kaartModel$;
    // this.bindToLifeCycle(kaartObs);

    this.internalMessage$.pipe(ofType<FeatureSelectieAangepastMsg>("FeatureSelectieAangepast")).subscribe(msg => {
      console.log("FeatureSelectieAangepast ontvangen");
      return this.geselecteerdeFeatures.emit(msg.geselecteerdeFeatures);
    });

    if (this.selectieModus) {
      this.dispatch(prt.ActiveerSelectieModusCmd(this.selectieModus));
    }
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ("selectieModus" in changes) {
      this.dispatch(prt.ActiveerSelectieModusCmd(this.selectieModus));
    }
  }
}
