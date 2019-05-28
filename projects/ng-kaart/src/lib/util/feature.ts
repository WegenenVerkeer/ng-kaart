import { option, setoid } from "fp-ts";
import { Curried2, Function1, Refinement } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";
import { Setoid, setoidString } from "fp-ts/lib/Setoid";
import * as ol from "openlayers";

import { kaartLogger } from "../kaart/log";

import { PartialFunction1 } from "./function";
import { GeoJsonCore } from "./geojson-types";

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
    return setLaagnaam(laagnaam)(feature);
  } catch (error) {
    const msg = `Kan geometry niet parsen: ${error}`;
    kaartLogger.error(msg);
    throw new Error(msg);
  }
};

// o.a. voor gebruik bij stijlen en identify
export const setLaagnaam: Curried2<string, ol.Feature, ol.Feature> = laagnaam => feature => {
  feature.set("laagnaam", laagnaam);
  return feature;
};

export const featureToGeojson: Function1<ol.Feature, any> = feature => {
  if (feature.get("features")) {
    return {
      type: "FeatureCollection",
      geometry: format.writeGeometryObject(feature.getGeometry()),
      features: feature.get("features").map(singleFeatureToGeojson)
    };
  } else {
    return singleFeatureToGeojson(feature);
  }
};

const singleFeatureToGeojson: Function1<ol.Feature, any> = feature => {
  return {
    type: "Feature",
    id: feature.getId(),
    geometry: format.writeGeometryObject(feature.getGeometry()),
    properties: feature.get("properties")
  };
};

export namespace Feature {
  export const propertyId: PartialFunction1<ol.Feature, string> = f => option.fromNullable(f.get("id")).map(id => id.toString());

  export const setoidFeaturePropertyId: Setoid<ol.Feature> = setoid.contramap(propertyId, option.getSetoid(setoidString));

  export const notInExtent: Function1<ol.Extent, Refinement<ol.Feature, ol.Feature>> = extent => (feature): feature is ol.Feature => {
    const [featureMinX, featureMinY, featureMaxX, featureMaxY]: ol.Extent = feature.getGeometry().getExtent();
    const [extentMinX, extentMinY, extentMaxX, extentMaxY]: ol.Extent = extent;
    return extentMinX > featureMaxX || extentMaxX < featureMinX || extentMinY > featureMaxY || extentMaxY < featureMinY;
  };
}
