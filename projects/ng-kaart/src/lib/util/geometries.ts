import * as array from "fp-ts/lib/Array";
import * as eq from "fp-ts/lib/Eq";
import { fieldNumber } from "fp-ts/lib/Field";
import { sum } from "fp-ts/lib/Foldable2v";
import { constant, Function1, identity } from "fp-ts/lib/function";
import { none, option, Option, some } from "fp-ts/lib/Option";

import * as ol from "./openlayers-compat";

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
  readonly geometry?: (_: ol.geom.Geometry) => T;
}

export function matchGeometryType<T>(geometry: ol.geom.Geometry, mapper: GeometryMapper<T>): Option<T> {
  const tryFallback = () => (mapper.geometry ? some(mapper.geometry(geometry)) : none);
  const applyIfDefined: <G extends ol.geom.Geometry>(f?: Function1<G, T>) => Option<T> = f => (f ? some(f(geometry as any)) : none);

  switch (geometry.getType()) {
    case "Point":
      return applyIfDefined<ol.geom.Point>(mapper.point).orElse(tryFallback);
    case "LineString":
      return applyIfDefined<ol.geom.LineString>(mapper.lineString).orElse(tryFallback);
    case "LinearRing":
      return applyIfDefined<ol.geom.LinearRing>(mapper.linearRing).orElse(tryFallback);
    case "Polygon":
      return applyIfDefined<ol.geom.Polygon>(mapper.polygon).orElse(tryFallback);
    case "MultiPoint":
      return applyIfDefined<ol.geom.MultiPoint>(mapper.multiPoint).orElse(tryFallback);
    case "MultiLineString":
      return applyIfDefined<ol.geom.MultiLineString>(mapper.multiLineString).orElse(tryFallback);
    case "MultiPolygon":
      return applyIfDefined<ol.geom.MultiPolygon>(mapper.multiPolygon).orElse(tryFallback);
    case "GeometryCollection":
      return applyIfDefined<ol.geom.GeometryCollection>(mapper.geometryCollection).orElse(tryFallback);
    case "Circle":
      return applyIfDefined<ol.geom.Circle>(mapper.circle).orElse(tryFallback);
  }
  return none;
}

export function toLineString(geometry: ol.geom.Geometry): Option<ol.geom.LineString> {
  return matchGeometryType(geometry, {
    lineString: line => some(line),
    multiLineString: line => some(new ol.geom.LineString(array.flatten(line.getCoordinates() as ol.Coordinate[][]))),
    polygon: poly => some(new ol.geom.LineString(array.flatten(poly.getCoordinates() as ol.Coordinate[][]))),
    geometryCollection: collection =>
      array.array
        .traverse(option)(collection.getGeometries(), toLineString)
        .map(lines => new ol.geom.LineString(array.flatten(lines.map(line => line.getCoordinates() as ol.Coordinate[]))))
  }).chain(identity);
}

const numberArraySum: Function1<number[], number> = sum(fieldNumber, array.array);

export function geometryLength(geometry: ol.geom.Geometry): number {
  return matchGeometryType(geometry, {
    point: constant(0),
    multiPoint: constant(0),
    lineString: line => line.getLength(),
    multiLineString: lines => numberArraySum(lines.getLineStrings().map(geometryLength)),
    polygon: poly => numberArraySum(poly.getLinearRings().map(geometryLength)),
    geometryCollection: collection => numberArraySum(collection.getGeometries().map(geometryLength)),
    circle: circle => circle.getRadius() * 2 * Math.PI,
    linearRing: ring => new ol.geom.LineString(ring.getCoordinates()).getLength(),
    multiPolygon: polys => numberArraySum(polys.getPolygons().map(geometryLength))
  }).getOrElse(0);
}

export function distance(coord1: ol.Coordinate, coord2: ol.Coordinate): number {
  return ol.Sphere.getLength(new ol.geom.LineString([coord1, coord2]));
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

export const eqCoordinate: eq.Eq<ol.Coordinate> = eq.getTupleEq(eq.eqNumber, eq.eqNumber);
