import { Component, DoCheck, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import * as prt from "../../kaart/kaart-protocol";
import { forEach } from "../../util/option";
import { KaartClassicComponent } from "../kaart-classic.component";
import { logOnlyWrapper } from "../messages";

import { ClassicVectorLaagComponent } from "./classic-vector-laag.component";

// Hier gaan we er van uit dat de feature zelf immutable is. Features moeten ook unieke IDs hebben.
const setoidFeature = {
  equals: (feat1: ol.Feature, feat2: ol.Feature) => feat1.getId === feat2.getId
};

const setoidFeatureArray = array.getSetoid(setoidFeature);

@Component({
  selector: "awv-kaart-features-laag",
  template: "",
  encapsulation: ViewEncapsulation.None
})
export class ClassicFeaturesLaagComponent extends ClassicVectorLaagComponent implements DoCheck {
  @Input() features = [] as ol.Feature[];

  // TODO combineren met 'selecteerbaar' van kaart-vector-laag
  @Output() featureGeselecteerd: EventEmitter<ol.Feature> = new EventEmitter<ol.Feature>();

  private vorigeFeatures: Option<ol.Feature[]> = none;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  voegLaagToe(): void {
    super.voegLaagToe();
    this.dispatchVervangFeatures(this.features);
  }

  verwijderLaag(): void {
    this.dispatchVervangFeatures([]);
    super.verwijderLaag(); // dit verwijdert de laag weer
  }

  ngDoCheck(): void {
    // deze check ipv ngOnChanges want wijzigingen aan features staan niet in SimpleChanges
    forEach(this.vorigeFeatures, features => {
      if (!setoidFeatureArray.equals(this.features, features)) {
        this.dispatchVervangFeatures(this.features);
      }
    });
  }

  private dispatchVervangFeatures(features: ol.Feature[]) {
    this.vorigeFeatures = some(features);
    this.dispatch(prt.VervangFeaturesCmd(this.titel, List(features), logOnlyWrapper));
  }
}
