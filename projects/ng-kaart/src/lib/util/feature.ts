import { option, setoid } from "fp-ts";
import { array, mapOption } from "fp-ts/lib/Array";
import { Curried2, Function1, Refinement } from "fp-ts/lib/function";
import { fromNullable, Option, option as optionMonad, tryCatch } from "fp-ts/lib/Option";
import { Setoid, setoidString } from "fp-ts/lib/Setoid";
import * as traversable from "fp-ts/lib/Traversable";
import * as ol from "openlayers";

import { kaartLogger } from "../kaart/log";

import * as arrays from "./arrays";
import { PartialFunction1 } from "./function";
import { GeoJsonCore, GeoJsonFeature, GeoJsonFeatureCollection, GeoJsonFeatures } from "./geojson-types";

// De GeoJSON ziet er thread safe uit (volgens de Openlayers source code)
const format = new ol.format.GeoJSON();

export const toOlFeature: Curried2<string, GeoJsonCore, ol.Feature> = laagnaam => geojson => {
  try {
    const feature = new ol.Feature({
      id: geojson.id,
      properties: geojson.properties,
      geometry: format.readGeometry(geojson.geometry)
    });
    feature.setId(geojson.id);
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

export const getUnderlyingFeatures: Function1<ol.Feature[], ol.Feature[]> = features =>
  array.chain(features, feature => (feature.get("features") ? feature.get("features") : [feature]));

const singleFeatureToGeoJson: PartialFunction1<ol.Feature, GeoJsonFeature> = feature =>
  tryCatch(() => ({
    type: "Feature" as "Feature",
    id: feature.getId(),
    geometry: format.writeGeometryObject(feature.getGeometry()),
    properties: feature.get("properties")
  }));

const multipleFeatureToGeoJson: Curried2<ol.geom.Geometry, ol.Feature[], Option<GeoJsonFeatureCollection>> = geometry => features => {
  return tryCatch(() => ({
    type: "FeatureCollection" as "FeatureCollection",
    geometry: format.writeGeometryObject(geometry),
    features: mapOption(features, singleFeatureToGeoJson)
  }));
};

export const featureToGeoJson: PartialFunction1<ol.Feature, GeoJsonFeatures> = feature => {
  const features = fromNullable(feature.get("features"));
  return features
    .filter(arrays.isArray)
    .chain<GeoJsonFeatureCollection | GeoJsonFeature>(multipleFeatureToGeoJson(feature.getGeometry()))
    .orElse(() => singleFeatureToGeoJson(feature));
};

export const clusterFeaturesToGeoJson: PartialFunction1<ol.Feature[], GeoJsonFeatures[]> = features =>
  traversable.traverse(optionMonad, array)(features, featureToGeoJson);

export namespace Feature {
  export const propertyId: PartialFunction1<ol.Feature, string> = feature =>
    option
      .fromNullable(feature.get("id"))
      .orElse(() => option.fromNullable(feature.getProperties().get("id")))
      .map(id => id.toString());

  export const properties: Function1<ol.Feature, any> = feature => feature.getProperties().properties;

  export const getLaagnaam: PartialFunction1<ol.Feature, string> = feature => {
    const singleFeature = fromNullable(feature.get("features"))
      .filter(arrays.isArray)
      .filter(arrays.isNonEmpty)
      .chain(features => fromNullable(features[0]))
      .getOrElse(feature);
    return fromNullable(singleFeature.get("laagnaam").toString());
  };

  export const setoidFeaturePropertyId: Setoid<ol.Feature> = setoid.contramap(propertyId, option.getSetoid(setoidString));

  export const notInExtent: Function1<ol.Extent, Refinement<ol.Feature, ol.Feature>> = extent => (feature): feature is ol.Feature => {
    const [featureMinX, featureMinY, featureMaxX, featureMaxY]: ol.Extent = feature.getGeometry().getExtent();
    const [extentMinX, extentMinY, extentMaxX, extentMaxY]: ol.Extent = extent;
    return extentMinX > featureMaxX || extentMaxX < featureMinX || extentMinY > featureMaxY || extentMaxY < featureMinY;
  };
}
