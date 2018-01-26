import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { ReplaySubject } from "rxjs/ReplaySubject";
import isEqual from "lodash-es/isEqual";

import * as ol from "openlayers";

import { KaartEventDispatcher } from "./kaart-event-dispatcher";
import {
  ExtentChanged,
  FocusOnMap,
  LoseFocusOnMap,
  MiddelpuntChanged,
  ViewportChanged,
  ZoomChanged,
  KaartEvnt
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
  @Input() minZoom = 2; // TODO moet nog doorgegeven worden
  @Input() maxZoom = 13;
  @Input() middelpunt: ol.Coordinate; // = [130000, 193000]; // "extent" heeft voorrang
  @Input() breedte; // neem standaard de hele breedte in
  @Input() hoogte = 400;
  @Input() extent: ol.Extent;
  @Input() naam = "kaart" + KaartClassicComponent.counter++;

  private readonly dispatcher: KaartEventDispatcher = new KaartEventDispatcher();
  private readonly modelSubj = new ReplaySubject<KaartWithInfo>(100, 1000);
  private hasFocus = false;

  // Deze zorgt ervoor dat we het model van de kaart component krijgen elke keer wanneer het (potentieel) veranderd.
  readonly modelConsumer: ModelConsumer<KaartWithInfo> = (model: KaartWithInfo) => this.modelSubj.next(model);

  constructor() {}

  ngOnInit() {
    // De volgorde van de dispatching hier is van belang voor wat de overhand heeft
    if (this.zoom) {
      this.dispatch(new ZoomChanged(this.zoom));
    }
    if (this.extent) {
      this.dispatch(new ExtentChanged(this.extent));
    }
    if (this.middelpunt) {
      this.dispatch(new MiddelpuntChanged(this.middelpunt));
    }
    if (this.breedte || this.hoogte) {
      this.dispatch(new ViewportChanged([this.breedte, this.hoogte]));
    }
  }

  ngOnDestroy() {}

  ngOnChanges(changes: SimpleChanges) {
    if ("zoom" in changes) {
      this.dispatch(new ZoomChanged(changes.zoom.currentValue));
    }
    if ("middelpunt" in changes && !isEqual(changes.middelpunt.currentValue, changes.middelpunt.previousValue)) {
      this.dispatch(new MiddelpuntChanged(changes.middelpunt.currentValue));
    }
    if ("extent" in changes && !isEqual(changes.extent.currentValue, changes.extent.previousValue)) {
      this.dispatch(new ExtentChanged(changes.extent.currentValue));
    }
    if ("breedte" in changes) {
      this.dispatch(new ViewportChanged([changes.breedte.currentValue, this.hoogte]));
    }
    if ("hoogte" in changes) {
      this.dispatch(new ViewportChanged([this.breedte, changes.hoogte.currentValue]));
    }
  }

  dispatch(evt: KaartEvnt) {
    this.dispatcher.dispatch(evt);
  }

  get event$(): Observable<KaartEvnt> {
    return this.dispatcher.event$;
  }

  get kaartModel$(): Observable<KaartWithInfo> {
    return this.modelSubj;
  }

  focus(): void {
    // Voor performantie
    if (!this.hasFocus) {
      this.hasFocus = true;
      this.dispatch(new FocusOnMap());
    }
  }

  geenFocus(): void {
    // Stuur enkel enkel indien nodig
    if (this.hasFocus) {
      this.hasFocus = false;
      this.dispatch(new LoseFocusOnMap());
    }
  }
}
