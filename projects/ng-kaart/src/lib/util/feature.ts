import { array, option, setoid } from "fp-ts";
import { array as arrayTraversable, foldLeft, mapOption } from "fp-ts/lib/Array";
import * as eq from "fp-ts/lib/Eq";
import { Curried2, FunctionN, Refinement } from "fp-ts/lib/function";
import { fromNullable, Option, option as optionApplcative, tryCatch } from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import * as traversable from "fp-ts/lib/Traversable";

import { kaartLogger } from "../kaart/log";

import * as arrays from "./arrays";
import { PartialFunction1 } from "./function";
import { GeoJsonCore, GeoJsonFeature, GeoJsonFeatureCollection, GeoJsonFeatures } from "./geojson-types";
import * as ol from "./openlayers-compat";

// De GeoJSON ziet er thread safe uit (volgens de Openlayers source code)
const format = new ol.format.GeoJSON();

export const toOlFeature: Curried2<string, GeoJsonCore, ol.Feature> = laagnaam => geojson => {
  // id moet uniek zijn over lagen heen , anders krijg je problemen als deze gemengd worden in de selection layer
  // de "echte" id van de geojson feature blijft staan in de properties van de feature
  // Feature.id mag dus niet meer gebruikt worden door clients, maar alleen intern door ng-kaart en openlayers
  try {
    const uniekId = geojson.id + "/" + laagnaam;
    const feature = new ol.Feature({
      id: geojson.id,
      properties: geojson.properties,
      geometry: format.readGeometry(geojson.geometry)
    });
    feature.setId(uniekId);
    return modifyWithLaagnaam(laagnaam)(feature);
  } catch (error) {
    const msg = `Kan geometry niet parsen: ${error}`;
    kaartLogger.error(msg);
    throw new Error(msg);
  }
};

// o.a. voor gebruik bij stijlen en identify
export const modifyWithLaagnaam: Curried2<string, ol.Feature, ol.Feature> = laagnaam => feature => {
  feature.set("laagnaam", laagnaam); // Opgelet: side-effect!
  return feature;
};

const singleFeatureToGeoJson: PartialFunction1<ol.Feature, GeoJsonFeature> = feature =>
  pipe(
    option.fromNullable(feature.getId()),
    option.chain(id =>
      pipe(
        option.fromNullable(feature.getGeometry()),
        option.chain(geometry =>
          option.tryCatch(() => ({
            type: "Feature" as "Feature",
            id,
            geometry: format.writeGeometryObject(geometry),
            properties: feature.get("properties")
          }))
        )
      )
    )
  );

const multipleFeatureToGeoJson: Curried2<ol.Feature, ol.Feature[], Option<GeoJsonFeatureCollection>> = feature => features => {
  return pipe(
    option.fromNullable(feature.getGeometry()),
    option.chain(geometry =>
      option.tryCatch(() => ({
        type: "FeatureCollection" as "FeatureCollection",
        geometry: format.writeGeometryObject(geometry),
        features: mapOption(features, singleFeatureToGeoJson)
      }))
    )
  );
};

export const featureToGeoJson: PartialFunction1<ol.Feature, GeoJsonFeatures> = feature => {
  const features = fromNullable(feature.get("features"));
  return features
    .filter(arrays.isArray)
    .chain<GeoJsonFeatureCollection | GeoJsonFeature>(multipleFeatureToGeoJson(feature))
    .orElse(() => singleFeatureToGeoJson(feature));
};

export const clusterFeaturesToGeoJson: PartialFunction1<ol.Feature[], GeoJsonFeatures[]> = features =>
  traversable.traverse(optionApplcative, arrayTraversable)(features, featureToGeoJson);

// Een type dat onze features encapsuleert. Die hebben in 99% van de gevallen een id en een laagnaam.
export interface FeatureWithIdAndLaagnaam {
  readonly id: string;
  readonly laagnaam: string;
  readonly feature: ol.Feature;
}

export namespace Feature {
  // geef de "echte" id van een Feature terug indien aanwezig, dus niet de technische sleutel die we hebben gezet in olToFeature
  export const propertyId: PartialFunction1<ol.Feature, string> = feature =>
    option.fromNullable(feature.getProperties()["id"]).map(id => id.toString());

  export const technicalId: PartialFunction1<ol.Feature, string> = feature => option.fromNullable(feature.getId()).map(id => id.toString());

  export const properties: FunctionN<[ol.Feature], any> = feature => feature.getProperties().properties;

  export const fieldKeyToPropertyPath: FunctionN<[string], string> = fieldKey => `properties.${fieldKey}`;

  const SelectionRenderedMarker = "selectionRendered";

  export const markSelectedRendered = (feature: ol.Feature): ol.Feature => {
    feature.set(SelectionRenderedMarker, true);
    return feature;
  };

  export const unmarkSelectedRendered = (feature: ol.Feature): ol.Feature => {
    feature.unset(SelectionRenderedMarker);
    return feature;
  };

  export const isSelectedRendered = (feature: ol.Feature): boolean => feature.get(SelectionRenderedMarker) === true;

  export const getLaagnaam: PartialFunction1<ol.Feature, string> = feature => {
    const singleFeature = fromNullable(feature.get("features"))
      .filter(arrays.isArray)
      .filter(arrays.isNonEmpty)
      .chain(features => fromNullable(features[0]))
      .getOrElse(feature);
    return fromNullable(singleFeature.get("laagnaam").toString());
  };

  export const featureWithIdAndLaagnaam: PartialFunction1<ol.Feature, FeatureWithIdAndLaagnaam> = feature =>
    pipe(
      feature,
      propertyId,
      option.chain(id =>
        pipe(
          getLaagnaam(feature),
          option.map(laagnaam => ({ id, laagnaam, feature }))
        )
      )
    );

  export const eqFeatureTechnicalId: eq.Eq<ol.Feature> = eq.contramap(technicalId)(option.getEq(eq.eqString));

  export const notInExtent: FunctionN<[ol.Extent], Refinement<ol.Feature, ol.Feature>> = extent => (feature): feature is ol.Feature => {
    const featureGeometry = feature.getGeometry();
    if (featureGeometry) {
      const [featureMinX, featureMinY, featureMaxX, featureMaxY]: ol.Extent = featureGeometry.getExtent();
      const [extentMinX, extentMinY, extentMaxX, extentMaxY]: ol.Extent = extent;
      return extentMinX > featureMaxX || extentMaxX < featureMinX || extentMinY > featureMaxY || extentMaxY < featureMinY;
    } else {
      return true;
    }
  };

  export const overlapsExtent: FunctionN<[ol.Extent], Refinement<ol.Feature, ol.Feature>> = extent => (feature): feature is ol.Feature => {
    const featureGeometry = feature.getGeometry();
    if (featureGeometry) {
      const [featureMinX, featureMinY, featureMaxX, featureMaxY]: ol.Extent = featureGeometry.getExtent();
      const [extentMinX, extentMinY, extentMaxX, extentMaxY]: ol.Extent = extent;
      return (
        ((extentMinX <= featureMaxX && extentMinX >= featureMinX) ||
          (extentMaxX <= featureMaxX && extentMaxX >= featureMinX) ||
          (extentMaxX >= featureMaxX && extentMinX <= featureMinX)) &&
        ((extentMinY <= featureMaxY && extentMinY >= featureMinY) ||
          (extentMaxY <= featureMaxY && extentMaxY >= featureMinY) ||
          (extentMaxY >= featureMaxY && extentMinY <= featureMinY))
      );
    } else {
      return false;
    }
  };

  export const combineExtents: PartialFunction1<ol.Extent[], ol.Extent> = foldLeft(
    () => option.none,
    (head, tail) =>
      arrays.isEmpty(tail) //
        ? option.some(head)
        : option.some(array.reduce([...head] as ol.Extent, ol.extent.extend)(tail)) // copie omdat we head niet willen aanpassen
  );
}
