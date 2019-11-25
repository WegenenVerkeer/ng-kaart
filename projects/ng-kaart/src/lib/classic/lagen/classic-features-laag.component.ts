import { HttpClient } from "@angular/common/http";
import { Component, EventEmitter, Injector, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { identity } from "fp-ts/lib/function";
import { Setoid } from "fp-ts/lib/Setoid";
import * as ol from "openlayers";

import { kaartLogger } from "../../kaart";
import { forChangedValue } from "../../kaart/kaart-component-base";
import * as prt from "../../kaart/kaart-protocol";
import * as arrays from "../../util/arrays";
import { GeoJsonLike } from "../../util/geojson-types";
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

const toOlFeatures = (features: GeoJsonLike[]) => {
  try {
    return features.map(feature =>
      new ol.format.GeoJSON().readFeature(feature, {
        dataProjection: "EPSG:31370",
        featureProjection: "EPSG:31370"
      })
    );
  } catch (e) {
    kaartLogger.error("Ongeldige geosjon data: ", e, features);
    return [];
  }
};

type FeatureEqualityFn = (feat1: ol.Feature, feat2: ol.Feature) => boolean;

// Hier gaan we er van uit dat de feature zelf immutable is. Features moeten ook unieke IDs hebben.
// De ids kunnen expliciet gezet zijn met ol.feature#setId of in de properties array staan.
const stdFeatureEquality = (feat1: ol.Feature, feat2: ol.Feature) => {
  const id1 = id(feat1);
  const id2 = id(feat2);
  return id1 !== undefined && id2 !== undefined && id1 === id2;
};

const featureEqualityToFeaturesSetoid = (eq: FeatureEqualityFn) => array.getSetoid({ equals: eq });

@Component({
  selector: "awv-kaart-features-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicFeaturesLaagComponent extends ClassicVectorLaagComponent implements OnChanges {
  private featuresSetoid: Setoid<ol.Feature[]> = featureEqualityToFeaturesSetoid(stdFeatureEquality);

  // Er wordt verwacht dat alle features een unieke ID hebben. Null of undefined ID's zorgen voor onnodige updates. Bovendien moet de hele
  // feature array aangepast worden. Dwz, je mag de array niet aanpassen en de referentie ongewijzigd laten. Dit is om performantieredenen.
  @Input()
  features = [] as ol.Feature[];
  @Input()
  featureEquality: FeatureEqualityFn = stdFeatureEquality;

  // TODO combineren met 'selecteerbaar' van kaart-vector-laag
  @Output()
  featureGeselecteerd: EventEmitter<ol.Feature> = new EventEmitter<ol.Feature>();

  constructor(injector: Injector, private readonly http: HttpClient) {
    super(injector);
  }

  @Input()
  set featuresGeojson(geojsons: string) {
    this.features = toOlFeatures(JSON.parse(geojsons));
    this.dispatchVervangFeatures(this.features);
  }

  @Input()
  set featuresUrl(url: string) {
    this.http.get<GeoJsonLike[]>(url).subscribe(result => {
      this.features = toOlFeatures(result);
      this.dispatchVervangFeatures(this.features);
    });
  }

  voegLaagToe(): void {
    super.voegLaagToe();
    this.dispatchVervangFeatures(this.features);
  }

  verwijderLaag(): void {
    this.dispatchVervangFeatures([]);
    super.verwijderLaag(); // dit verwijdert de laag weer
  }

  ngOnChanges(changes: SimpleChanges) {
    forChangedValue<FeatureEqualityFn, FeatureEqualityFn>(changes, "featureEquality", eq => {
      this.featuresSetoid = featureEqualityToFeaturesSetoid(eq);
    });
    if (changes.features && !changes.features.firstChange) {
      forChangedValue<ol.Feature[], ol.Feature[]>(
        changes,
        "features",
        features => this.dispatchVervangFeatures(features),
        identity,
        (curFeatures: ol.Feature[], prevFeatures: ol.Feature[]) =>
          prevFeatures !== undefined && !this.featuresSetoid.equals(curFeatures, prevFeatures)
      );
    }
    super.ngOnChanges(changes);
  }

  private dispatchVervangFeatures(features: ol.Feature[]) {
    this.dispatch(prt.VervangFeaturesCmd(this._titel, arrays.fromNullable(features), logOnlyWrapper));
  }
}
