import { Component, DoCheck, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";

import isEqual from "lodash-es/isEqual";
import * as ol from "openlayers";

import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { ClearFeatures, RenderFeatures, ReplaceFeatures } from "./kaart-protocol-events";

@Component({
  selector: "awv-kaart-toon-features",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartToonFeaturesComponent extends KaartVectorLaagComponent implements OnInit, OnDestroy, DoCheck {
  @Input() features = new ol.Collection<ol.Feature>();

  // TODO combineren met 'selecteerbaar' van kaart-vector-laag
  @Output() featureGeselecteerd: EventEmitter<ol.Feature> = new EventEmitter<ol.Feature>();

  private vorigeFeatures: ol.Feature[] = [];

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.vorigeFeatures = this.features.getArray();
    this.dispatch(new RenderFeatures(this.titel, this.features));
  }

  ngOnDestroy(): void {
    this.dispatch(new ClearFeatures(this.titel));
    super.ngOnDestroy();
  }

  ngDoCheck(): void {
    // deze check ipv ngOnChanges want wijziging aan features staat niet in SimpleChanges
    if (!isEqual(this.vorigeFeatures, this.features.getArray())) {
      this.vorigeFeatures = this.features.getArray();
      this.dispatch(new ReplaceFeatures(this.titel, this.features));
    }
  }
}
