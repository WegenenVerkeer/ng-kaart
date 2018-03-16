import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { ReplaySubject } from "rxjs/ReplaySubject";

import * as ol from "openlayers";

import { ReplaySubjectKaartEventDispatcher } from "./kaart-event-dispatcher";
import {
  VeranderExtent,
  FocusOpKaart,
  VerliesFocusOpKaart,
  VeranderMiddelpunt,
  VeranderViewport,
  VeranderZoomniveau,
  KaartMessage
} from "./kaart-protocol-events";
import { ModelConsumer } from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";

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

  private readonly dispatcher: ReplaySubjectKaartEventDispatcher = new ReplaySubjectKaartEventDispatcher();
  private readonly modelSubj = new ReplaySubject<KaartWithInfo>(100, 1000);
  private hasFocus = false;

  // Deze zorgt ervoor dat we het model van de kaart component krijgen elke keer wanneer het (potentieel) veranderd.
  readonly modelConsumer: ModelConsumer<KaartWithInfo> = (model: KaartWithInfo) => this.modelSubj.next(model);

  constructor() {}

  ngOnInit() {
    // De volgorde van de dispatching hier is van belang voor wat de overhand heeft
    if (this.zoom) {
      this.dispatch(new VeranderZoomniveau(this.zoom));
    }
    if (this.extent) {
      this.dispatch(new VeranderExtent(this.extent));
    }
    if (this.middelpunt) {
      this.dispatch(new VeranderMiddelpunt(this.middelpunt));
    }
    if (this.breedte || this.hoogte) {
      this.dispatch(new VeranderViewport([this.breedte, this.hoogte]));
    }
  }

  ngOnDestroy() {}

  ngOnChanges(changes: SimpleChanges) {
    if ("zoom" in changes) {
      this.dispatch(new VeranderZoomniveau(changes.zoom.currentValue));
    }
    if ("middelpunt" in changes && !coordinateIsEqual(changes.middelpunt.currentValue)(changes.middelpunt.previousValue)) {
      this.dispatch(new VeranderMiddelpunt(changes.middelpunt.currentValue));
    }
    if ("extent" in changes && !extentIsEqual(changes.extent.currentValue)(changes.extent.previousValue)) {
      this.dispatch(new VeranderExtent(changes.extent.currentValue));
    }
    if ("breedte" in changes) {
      this.dispatch(new VeranderViewport([changes.breedte.currentValue, this.hoogte]));
    }
    if ("hoogte" in changes) {
      this.dispatch(new VeranderViewport([this.breedte, changes.hoogte.currentValue]));
    }
  }

  dispatch(evt: KaartMessage) {
    this.dispatcher.dispatch(evt);
  }

  get event$(): Observable<KaartMessage> {
    return this.dispatcher.event$;
  }

  get kaartModel$(): Observable<KaartWithInfo> {
    return this.modelSubj;
  }

  focus(): void {
    // Voor performantie
    if (!this.hasFocus) {
      this.hasFocus = true;
      this.dispatch(new FocusOpKaart());
    }
  }

  geenFocus(): void {
    // Stuur enkel enkel indien nodig
    if (this.hasFocus) {
      this.hasFocus = false;
      this.dispatch(new VerliesFocusOpKaart());
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
