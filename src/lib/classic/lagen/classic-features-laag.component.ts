import { Component, DoCheck, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { Setoid } from "fp-ts/lib/Setoid";
import { List } from "immutable";
import * as ol from "openlayers";

import { forChangedValue } from "../../kaart/kaart-component-base";
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

const featureEqualityToFeaturesSetoid = (eq: (feat1: ol.Feature, feat2: ol.Feature) => boolean) => array.getSetoid({ equals: eq });

@Component({
  selector: "awv-kaart-features-laag",
  template: "",
  encapsulation: ViewEncapsulation.None
})
export class ClassicFeaturesLaagComponent extends ClassicVectorLaagComponent implements OnChanges {
  private featuresSetoid: Setoid<ol.Feature[]> = featureEqualityToFeaturesSetoid(stdFeatureEquality);

  // Er wordt verwacht dat alle features een unieke ID hebben. Null of undefined ID's zorgen voor onnodige updates. Bovendien moet de hele
  // feature array aangepast worden. Dwz, je mag de array niet aanpassen en de refentie ongewijzigd laten. Dit is om performantieredenen.
  @Input() features = [] as ol.Feature[];
  @Input() featureEquality: (feat1: ol.Feature, feat2: ol.Feature) => boolean = stdFeatureEquality;

  // TODO combineren met 'selecteerbaar' van kaart-vector-laag
  @Output() featureGeselecteerd: EventEmitter<ol.Feature> = new EventEmitter<ol.Feature>();

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  voegLaagToe(): void {
    console.log("****voegLaagToe");
    super.voegLaagToe();
    this.dispatchVervangFeatures(this.features);
  }

  verwijderLaag(): void {
    this.dispatchVervangFeatures([]);
    super.verwijderLaag(); // dit verwijdert de laag weer
  }

  ngOnChanges(changes: SimpleChanges) {
    forChangedValue(changes, "featureEquality", eq => {
      this.featuresSetoid = featureEqualityToFeaturesSetoid(eq);
    });
    if (changes.features && !changes.features.firstChange) {
      forChangedValue(
        changes,
        "features",
        features => this.dispatchVervangFeatures(features),
        (curFeatures: ol.Feature[], prevFeatures: ol.Feature[]) =>
          prevFeatures !== undefined && !this.featuresSetoid.equals(curFeatures, prevFeatures)
      );
    }
  }

  private dispatchVervangFeatures(features: ol.Feature[]) {
    this.dispatch(prt.VervangFeaturesCmd(this.titel, List(features), logOnlyWrapper));
  }
}
