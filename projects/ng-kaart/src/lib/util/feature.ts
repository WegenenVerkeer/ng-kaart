import { Curried2 } from "fp-ts/lib/function";
import * as ol from "openlayers";

import { kaartLogger } from "../kaart/log";

import { GeoJsonCore } from "./geojson-types";

// De GeoJSON ziet er thread safe uit (volgens de Openlayers source code)
const format = new ol.format.GeoJSON();

export const toOlFeature: Curried2<string, GeoJsonCore, ol.Feature> = laagnaam => geojson => {
  try {
    return new ol.Feature({
      id: geojson.id,
      properties: geojson.properties,
      geometry: format.readGeometry(geojson.geometry),
      laagnaam: laagnaam
    });
  } catch (error) {
    const msg = `Kan geometry niet parsen: ${error}`;
    kaartLogger.error(msg);
    throw new Error(msg);
  }
};
