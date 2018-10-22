import { fromNullable, none, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";

export interface GeometryMapper<T> {
  readonly point?: (_: ol.geom.Point) => T;
  readonly lineString?: (_: ol.geom.LineString) => T;
  readonly linearRing?: (_: ol.geom.LinearRing) => T;
  readonly polygon?: (_: ol.geom.Polygon) => T;
  readonly multiPoint?: (_: ol.geom.MultiPoint) => T;
  readonly multiLineString?: (_: ol.geom.MultiLineString) => T;
  readonly multiPolygon?: (_: ol.geom.MultiPolygon) => T;
  readonly geometryCollection?: (_: ol.geom.GeometryCollection) => T;
  readonly circle?: (_: ol.geom.Circle) => T;
}

export function matchGeometryType<T>(geometry: ol.geom.Geometry, mapper: GeometryMapper<T>): Option<T> {
  switch (geometry.getType()) {
    case "Point":
      return mapper.point ? fromNullable(mapper.point(geometry as ol.geom.Point)) : none;
    case "LineString":
      return mapper.lineString ? fromNullable(mapper.lineString(geometry as ol.geom.LineString)) : none;
    case "LinearRing":
      return mapper.linearRing ? fromNullable(mapper.linearRing(geometry as ol.geom.LinearRing)) : none;
    case "Polygon":
      return mapper.polygon ? fromNullable(mapper.polygon(geometry as ol.geom.Polygon)) : none;
    case "MultiPoint":
      return mapper.multiPoint ? fromNullable(mapper.multiPoint(geometry as ol.geom.MultiPoint)) : none;
    case "MultiLineString":
      return mapper.multiLineString ? fromNullable(mapper.multiLineString(geometry as ol.geom.MultiLineString)) : none;
    case "MultiPolygon":
      return mapper.multiPolygon ? fromNullable(mapper.multiPolygon(geometry as ol.geom.MultiPolygon)) : none;
    case "GeometryCollection":
      return mapper.geometryCollection ? fromNullable(mapper.geometryCollection(geometry as ol.geom.GeometryCollection)) : none;
    case "Circle":
      return mapper.circle ? fromNullable(mapper.circle(geometry as ol.geom.Circle)) : none;
  }
  return none;
}

export function dimensieBeschrijving(geometry: ol.geom.Geometry, verbose = true): string {
  const sup2 = "\u00B2";

  function formatArea(area: number): string {
    return area > 10000 ? Math.round((area / 1000000) * 100) / 100 + " " + "km" + sup2 : Math.round(area * 100) / 100 + " " + "m" + sup2;
  }

  function formatLength(length: number): string {
    return length > 1000 ? Math.round((length / 1000) * 100) / 100 + " " + "km" : Math.round(length * 100) / 100 + " " + "m";
  }

  const area = ol.Sphere.getArea(geometry);
  const length = ol.Sphere.getLength(geometry);

  if (area === 0.0 || area === 0) {
    // als slechts 2 meetpunten, dan moeten we de lengte halveren, oppervlakte beschrijving weglaten
    if (verbose) {
      return "De lengte is " + formatLength(length / 2);
    } else {
      return formatLength(length / 2);
    }
  } else {
    if (verbose) {
      return "De lengte is " + formatLength(length) + " en de oppervlakte is " + formatArea(area);
    } else {
      return formatArea(area);
    }
  }
}
