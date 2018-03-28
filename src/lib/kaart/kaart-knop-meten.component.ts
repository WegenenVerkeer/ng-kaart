import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { Observable } from "rxjs/Observable";
import * as ol from "openlayers";

import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartInternalMsg, KaartInternalSubMsg } from "./kaart-internal-messages";

import * as ke from "./kaart-elementen";

@Component({
  selector: "awv-kaart-knop-meten",
  templateUrl: "./kaart-knop-meten.component.html",
  styleUrls: ["./kaart-knop-meten.component.scss"]
})
export class KaartTekenLengteOppervlakteLaagComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();

  constructor(zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    console.log("Start meten component");
  }

  ngOnDestroy(): void {
    this.dispatcher.dispatch({ type: "StopMetenLengteOppervlakte" });
  }

  meet(): void {
    this.dispatcher.dispatch({ type: "BeginMetenLengteOppervlakte" });
  }
}
