import * as strmap from "fp-ts/lib/StrMap";

import { Versions } from "./waypoint-ops";
import { Waypoint, WaypointId } from "./waypoint.msg";

export interface ProtoRoute {
  readonly id: string;
  readonly version: number;
  readonly begin: Waypoint;
  readonly end: Waypoint;
}

export interface GeometryRoute {
  id: string;
  version: number;
  begin: Waypoint;
  end: Waypoint;
  geometry: ol.geom.Geometry;
}

export type RouteEvent = RouteAdded | RouteRemoved;

export type RouteEventId = string;

export interface RouteAdded {
  readonly type: "RouteAdded";
  readonly id: RouteEventId;
  readonly version: number;
  readonly startWaypointId: WaypointId; // we moeten weten waar in de volgorde van deelroutes dit thuis hoort om de lengte te kunnen meten
  readonly geometry: ol.geom.Geometry;
}

export interface RouteRemoved {
  readonly type: "RouteRemoved";
  readonly id: RouteEventId;
  readonly version: number;
  readonly startWaypointId: WaypointId;
}

export function createRoute(begin: Waypoint, end: Waypoint, versions: Versions): ProtoRoute {
  const id = `${begin.id}_${end.id}`;
  return {
    id: id,
    version: strmap.lookup(id, versions).fold(0, n => n + 1),
    begin: begin,
    end: end
  };
}

export function routeAdded(geometryRoute: GeometryRoute): RouteAdded {
  return {
    type: "RouteAdded",
    id: geometryRoute.id,
    version: geometryRoute.version,
    startWaypointId: geometryRoute.begin.id,
    geometry: geometryRoute.geometry
  };
}

export function routeRemoved(protoRoute: ProtoRoute): RouteRemoved {
  return {
    type: "RouteRemoved",
    id: protoRoute.id,
    version: protoRoute.version,
    startWaypointId: protoRoute.begin.id
  };
}
