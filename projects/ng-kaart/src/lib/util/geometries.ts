import { array, eq, field, foldable, option } from "fp-ts";
import { constant, identity } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";

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

export function matchGeometryType<T>(
  geometry: ol.geom.Geometry,
  mapper: GeometryMapper<T>
): option.Option<T> {
  const tryFallback = () =>
    mapper.geometry ? option.some(mapper.geometry(geometry)) : option.none;
  const applyIfDefined: <G extends ol.geom.Geometry>(
    f?: (arg: G) => T
  ) => option.Option<T> = (f) =>
    f ? option.some(f(geometry as any)) : option.none;

  switch (geometry.getType()) {
    case "Point":
      return pipe(
        applyIfDefined<ol.geom.Point>(mapper.point),
        option.alt(tryFallback)
      );
    case "LineString":
      return pipe(
        applyIfDefined<ol.geom.LineString>(mapper.lineString),
        option.alt(tryFallback)
      );
    case "LinearRing":
      return pipe(
        applyIfDefined<ol.geom.LinearRing>(mapper.linearRing),
        option.alt(tryFallback)
      );
    case "Polygon":
      return pipe(
        applyIfDefined<ol.geom.Polygon>(mapper.polygon),
        option.alt(tryFallback)
      );
    case "MultiPoint":
      return pipe(
        applyIfDefined<ol.geom.MultiPoint>(mapper.multiPoint),
        option.alt(tryFallback)
      );
    case "MultiLineString":
      return pipe(
        applyIfDefined<ol.geom.MultiLineString>(mapper.multiLineString),
        option.alt(tryFallback)
      );
    case "MultiPolygon":
      return pipe(
        applyIfDefined<ol.geom.MultiPolygon>(mapper.multiPolygon),
        option.alt(tryFallback)
      );
    case "GeometryCollection":
      return pipe(
        applyIfDefined<ol.geom.GeometryCollection>(mapper.geometryCollection),
        option.alt(tryFallback)
      );
    case "Circle":
      return pipe(
        applyIfDefined<ol.geom.Circle>(mapper.circle),
        option.alt(tryFallback)
      );
  }
  return option.none;
}

export function toLineString(
  geometry: ol.geom.Geometry
): option.Option<ol.geom.LineString> {
  return pipe(
    matchGeometryType(geometry, {
      lineString: (line) => option.some(line),
      multiLineString: (line) =>
        option.some(
          new ol.geom.LineString(
            array.flatten(line.getCoordinates() as ol.Coordinate[][])
          )
        ),
      polygon: (poly) =>
        option.some(
          new ol.geom.LineString(
            array.flatten(poly.getCoordinates() as ol.Coordinate[][])
          )
        ),
      geometryCollection: (collection) =>
        pipe(
          array.array.traverse(option.option)(
            collection.getGeometries(),
            toLineString
          ),
          option.map(
            (lines: ol.geom.LineString[]) =>
              new ol.geom.LineString(
                array.flatten(
                  lines.map(
                    (line: ol.geom.LineString) =>
                      line.getCoordinates() as ol.Coordinate[]
                  )
                )
              )
          )
        ),
    }),
    option.chain(identity)
  );
}

const numberArraySum: (arg: number[]) => number = array.reduce(
  0,
  field.fieldNumber.add
);

export function geometryLength(geometry: ol.geom.Geometry): number {
  return pipe(
    matchGeometryType(geometry, {
      point: constant(0),
      multiPoint: constant(0),
      lineString: (line) => line.getLength(),
      multiLineString: (lines) =>
        numberArraySum(lines.getLineStrings().map(geometryLength)),
      polygon: (poly) =>
        numberArraySum(poly.getLinearRings().map(geometryLength)),
      geometryCollection: (collection) =>
        numberArraySum(collection.getGeometries().map(geometryLength)),
      circle: (circle) => circle.getRadius() * 2 * Math.PI,
      linearRing: (ring) =>
        new ol.geom.LineString(ring.getCoordinates()).getLength(),
      multiPolygon: (polys) =>
        numberArraySum(polys.getPolygons().map(geometryLength)),
    }),
    option.getOrElse(() => 0)
  );
}

export function geometryCoordinates(geometry: ol.geom.Geometry): number[] {
  return pipe(
    matchGeometryType(geometry, {
      point: (point) => point.getFlatCoordinates(),
      multiPoint: (multiPoint) => multiPoint.getFlatCoordinates(),
      lineString: (line) => line.getFlatCoordinates(),
      multiLineString: (lines) => lines.getFlatCoordinates(),
      polygon: (poly) => poly.getFlatCoordinates(),
      geometryCollection: (collection) =>
        [].concat.apply(
          [],
          collection.getGeometries().map((geom) => geometryCoordinates(geom))
        ),
      circle: (circle) => circle.getCenter(),
      linearRing: (ring) => ring.getFlatCoordinates(),
      multiPolygon: (polys) => polys.getFlatCoordinates(),
    }),
    option.getOrElse(() => [])
  );
}

export function distance(coord1: ol.Coordinate, coord2: ol.Coordinate): number {
  return ol.Sphere.getLength(new ol.geom.LineString([coord1, coord2]));
}

export function dimensieBeschrijving(
  geometry: ol.geom.Geometry,
  verbose = true
): string {
  const sup2 = "\u00B2";

  function formatArea(area: number): string {
    return area > 10000
      ? Math.round((area / 1000000) * 100) / 100 + " " + "km" + sup2
      : Math.round(area * 100) / 100 + " " + "m" + sup2;
  }

  function formatLength(length: number): string {
    return length > 1000
      ? Math.round((length / 1000) * 100) / 100 + " " + "km"
      : Math.round(length * 100) / 100 + " " + "m";
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
      return (
        "De lengte is " +
        formatLength(length) +
        " en de oppervlakte is " +
        formatArea(area)
      );
    } else {
      return formatArea(area);
    }
  }
}

export const eqCoordinate: eq.Eq<ol.Coordinate> = eq.getTupleEq(
  eq.eqNumber,
  eq.eqNumber
);
