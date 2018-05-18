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
