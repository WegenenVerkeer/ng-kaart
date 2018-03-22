import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { Observable } from "rxjs/Observable";

import * as ol from "openlayers";

import { ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import { Command } from "./kaart-protocol-commands";
import * as prt from "./kaart-protocol";
import { KaartInternalMsg, forgetWrapper } from "./kaart-internal-messages";
import { KaartMsgObservableConsumer } from ".";

@Component({
  selector: "awv-kaart-classic",
  templateUrl: "./kaart-classic.component.html"
})
export class KaartClassicComponent implements OnInit, OnDestroy, OnChanges {
  private static counter = 1;

  @Input() zoom: number;
  @Input() minZoom = 0;
  @Input() maxZoom = 15;
  @Input() middelpunt: ol.Coordinate; // = [130000, 193000]; // "extent" heeft voorrang
  @Input() breedte; // neem standaard de hele breedte in
  @Input() hoogte = 400;
  @Input() mijnLocatieZoom: number | undefined;
  @Input() extent: ol.Extent;
  @Input() naam = "kaart" + KaartClassicComponent.counter++;

  private hasFocus = false;
  readonly dispatcher: ReplaySubjectKaartCmdDispatcher<KaartInternalMsg> = new ReplaySubjectKaartCmdDispatcher();
  message$: Observable<prt.KaartMsg> = Observable.never();

  constructor() {}

  ngOnInit() {
    // De volgorde van de dispatching hier is van belang voor wat de overhand heeft
    if (this.zoom) {
      this.dispatch({ type: "VeranderZoom", zoom: this.zoom, wrapper: forgetWrapper });
    }
    if (this.extent) {
      this.dispatch({ type: "VeranderExtent", extent: this.extent });
    }
    if (this.middelpunt) {
      this.dispatch({ type: "VeranderMiddelpunt", coordinate: this.middelpunt });
    }
    if (this.breedte || this.hoogte) {
      this.dispatch({ type: "VeranderViewport", size: [this.breedte, this.hoogte] });
    }
  }

  ngOnDestroy() {}

  ngOnChanges(changes: SimpleChanges) {
    if ("zoom" in changes) {
      this.dispatch({ type: "VeranderZoom", zoom: changes.zoom.currentValue, wrapper: forgetWrapper });
    }
    if ("middelpunt" in changes && !coordinateIsEqual(changes.middelpunt.currentValue)(changes.middelpunt.previousValue)) {
      this.dispatch({ type: "VeranderMiddelpunt", coordinate: changes.middelpunt.currentValue });
    }
    if ("extent" in changes && !extentIsEqual(changes.extent.currentValue)(changes.extent.previousValue)) {
      this.dispatch({ type: "VeranderExtent", extent: changes.extent.currentValue });
    }
    if ("breedte" in changes) {
      this.dispatch({ type: "VeranderMiddelpunt", coordinate: [changes.breedte.currentValue, this.hoogte] });
    }
    if ("hoogte" in changes) {
      this.dispatch({ type: "VeranderViewport", size: [this.breedte, changes.hoogte.currentValue] });
    }
  }

  messageObsConsumer(): KaartMsgObservableConsumer {
    return (msg$: Observable<prt.KaartMsg>) => {
      this.message$ = msg$;
    };
  }

  dispatch(cmd: prt.Command<KaartInternalMsg>) {
    this.dispatcher.dispatch(cmd);
  }

  get kaartCmd$(): Observable<Command<prt.KaartMsg>> {
    return this.dispatcher.commands$;
  }

  focus(): void {
    // Voor performantie
    if (!this.hasFocus) {
      this.hasFocus = true;
      this.dispatch({ type: "FocusOpKaart" });
    }
  }

  geenFocus(): void {
    // Stuur enkel enkel indien nodig
    if (this.hasFocus) {
      this.hasFocus = false;
      this.dispatch({ type: "VerliesFocusOpKaart" });
    }
  }
}

const coordinateIsEqual = (coor1: ol.Coordinate) => (coor2: ol.Coordinate) => {
  if (!coor1 && !coor2) {
    return true;
  }
  if (!coor1 || !coor2) {
    return false;
  }
  return coor1[0] === coor2[0] && coor1[1] === coor2[1];
};

const extentIsEqual = (ext1: ol.Extent) => (ext2: ol.Extent) => {
  if (!ext1 && !ext2) {
    return true;
  }
  if (!ext1 || !ext2) {
    return false;
  }
  return ext1[0] === ext2[0] && ext1[1] === ext2[1] && ext1[2] === ext2[2] && ext1[3] === ext2[3];
};
