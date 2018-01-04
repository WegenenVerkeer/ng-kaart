import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import isEqual from "lodash-es/isEqual";

import * as ol from "openlayers";

import { KaartEventDispatcher } from "./kaart-event-dispatcher";
import { ExtentChanged, FocusOnMap, LoseFocusOnMap, MiddelpuntChanged, ViewportChanged, ZoomChanged } from "./kaart-protocol-events";

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

  readonly dispatcher: KaartEventDispatcher = new KaartEventDispatcher();

  constructor() {}

  ngOnInit() {
    // De volgorde van de dispatching hier is van belang voor wat de overhand heeft
    if (this.zoom) {
      this.dispatcher.dispatch(new ZoomChanged(this.zoom));
    }
    if (this.extent) {
      this.dispatcher.dispatch(new ExtentChanged(this.extent));
    }
    if (this.middelpunt) {
      this.dispatcher.dispatch(new MiddelpuntChanged(this.middelpunt));
    }
    if (this.breedte || this.hoogte) {
      this.dispatcher.dispatch(new ViewportChanged([this.breedte, this.hoogte]));
    }
  }

  ngOnDestroy() {}

  ngOnChanges(changes: SimpleChanges) {
    if ("zoom" in changes) {
      this.dispatcher.dispatch(new ZoomChanged(changes.zoom.currentValue));
    }
    if ("middelpunt" in changes && !isEqual(changes.middelpunt.currentValue, changes.middelpunt.previousValue)) {
      this.dispatcher.dispatch(new MiddelpuntChanged(changes.middelpunt.currentValue));
    }
    if ("extent" in changes && !isEqual(changes.extent.currentValue, changes.extent.previousValue)) {
      this.dispatcher.dispatch(new ExtentChanged(changes.extent.currentValue));
    }
    if ("breedte" in changes) {
      this.dispatcher.dispatch(new ViewportChanged([changes.breedte.currentValue, this.hoogte]));
    }
    if ("hoogte" in changes) {
      this.dispatcher.dispatch(new ViewportChanged([this.breedte, changes.hoogte.currentValue]));
    }
  }

  focus(): void {
    this.dispatcher.dispatch(new FocusOnMap());
  }

  geenFocus(): void {
    this.dispatcher.dispatch(new LoseFocusOnMap());
  }
}
