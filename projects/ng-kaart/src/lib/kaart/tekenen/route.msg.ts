import { Waypoint } from "./waypoint.msg";

export interface ProtoRoute {
  id: string;
  begin: Waypoint;
  end: Waypoint;
}

export interface GeometryRoute {
  id: string;
  begin: Waypoint;
  end: Waypoint;
  geometry: ol.geom.Geometry;
}

export type RouteEvent = RouteAdded | RouteRemoved;

export interface RouteAdded {
  readonly type: "RouteAdded";
  readonly id: string;
  readonly geometry: ol.geom.Geometry;
}

export function RouteAdded(id: string, geometry: ol.geom.Geometry): RouteAdded {
  return {
    type: "RouteAdded",
    id: id,
    geometry: geometry
  };
}

export interface RouteRemoved {
  readonly type: "RouteRemoved";
  readonly id: string;
}

export function RouteRemoved(id: string): RouteRemoved {
  return {
    type: "RouteRemoved",
    id: id
  };
}
