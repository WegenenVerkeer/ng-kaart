import { Component, DoCheck, EventEmitter, Input, Output, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import * as prt from "../../kaart/kaart-protocol";
import { forEach } from "../../util/option";
import { KaartClassicComponent } from "../kaart-classic.component";
import { logOnlyWrapper } from "../messages";

import { ClassicVectorLaagComponent } from "./classic-vector-laag.component";

const id = (feat: ol.Feature) => {
  const featId = feat.getId();
  if (featId !== undefined) {
    return featId;
  } else {
    const props = feat.getProperties();
    if (props !== undefined && props !== null) {
      return props["id"];
    } else {
      return undefined;
    }
  }
};

// Hier gaan we er van uit dat de feature zelf immutable is. Features moeten ook unieke IDs hebben.
// De ids kunnen expliciet gezet zijn met ol.feature#setId of in de properties array staan.
const stdFeatureEquality = (feat1: ol.Feature, feat2: ol.Feature) => {
  const id1 = id(feat1);
  const id2 = id(feat2);
  return id1 !== undefined && id2 !== undefined && id1 === id2;
};

@Component({
  selector: "awv-kaart-features-laag",
  template: "",
  encapsulation: ViewEncapsulation.None
})
export class ClassicFeaturesLaagComponent extends ClassicVectorLaagComponent implements DoCheck {
  // Er wordt verwacht dat alle features een unieke ID hebben. Null of undefined ID's zorgen voor veel onnodige updates.
  @Input() features = [] as ol.Feature[];
  @Input() featureEquality: (feat1: ol.Feature, feat2: ol.Feature) => boolean = stdFeatureEquality;

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
      if (
        !array
          .getSetoid({ equals: (feat1: ol.Feature, feat2: ol.Feature) => this.featureEquality(feat1, feat2) })
          .equals(this.features, features)
      ) {
        this.dispatchVervangFeatures(this.features);
      }
    });
  }

  private dispatchVervangFeatures(features: ol.Feature[]) {
    this.vorigeFeatures = some(array.copy(features));
    this.dispatch(prt.VervangFeaturesCmd(this.titel, List(features), logOnlyWrapper));
  }
}
