import {Component, DoCheck, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewEncapsulation} from "@angular/core";
import {KaartComponent} from "./kaart.component";
import {KaartVectorLaagComponent} from "./kaart-vector-laag.component";

import isEqual from "lodash-es/isEqual";

import * as ol from "openlayers";

@Component({
  selector: "awv-kaart-toon-features",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartToonFeaturesComponent extends KaartVectorLaagComponent implements OnInit, OnDestroy, DoCheck {
  @Input() features = new ol.Collection<ol.Feature>();
  @Output() featureGeselecteerd: EventEmitter<ol.Feature> = new EventEmitter<ol.Feature>();

  selecteerFeatureInteraction: ol.interaction.Select;
  vorigeFeatures: ol.Feature[] = [];

  constructor(protected kaart: KaartComponent, protected zone: NgZone) {
    super(kaart, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.zone.runOutsideAngular(() => {
      this.renderFeatures(this.features);
    });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.zone.runOutsideAngular(() => {
      this.clear();
    });
  }

  ngDoCheck(): void {
    if (!this.vectorLaag) {
      return;
    }

    if (!isEqual(this.vorigeFeatures, this.features.getArray())) {
      this.zone.runOutsideAngular(() => {
        this.clear();
        this.renderFeatures(this.features);
      });
    }
  }

  private renderFeatures(features: ol.Collection<ol.Feature>) {
    this.vectorLaag.getSource().addFeatures(features.getArray());
    this.vorigeFeatures = features.getArray();

    if (!this.selecteerFeatureInteraction) {
      this.selecteerFeatureInteraction = new ol.interaction.Select({
        features: features,
        layers: layer => layer.get("selectable") === true,
        condition: ol.events.condition.singleClick
      });

      this.selecteerFeatureInteraction.on("select", event => {
        if (event.selected.length > 0) {
          this.zone.run(() => {
            this.featureGeselecteerd.emit(event.selected[0]);
          });
        }
      });

      this.kaart.map.addInteraction(this.selecteerFeatureInteraction);
    }
  }

  private clear() {
    this.vectorLaag.getSource().clear(true);
    this.kaart.map.removeInteraction(this.selecteerFeatureInteraction);
  }
}
