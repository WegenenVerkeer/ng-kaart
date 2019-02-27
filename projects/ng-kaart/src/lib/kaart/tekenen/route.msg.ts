import { Option } from "fp-ts/lib/Option";
import * as strmap from "fp-ts/lib/StrMap";

import { Versions } from "./waypoint-ops";
import { Waypoint, WaypointId } from "./waypoint.msg";

// Het type dat encodeert tussen welke 2 punten een verbindig gemaakt moet worden
export interface ProtoRoute {
  readonly id: string;
  readonly version: number;
  readonly begin: Waypoint;
  readonly end: Waypoint;
}

// Het type dat de berekende geometrie tussen 2 punten beschrijft
export interface GeometryRoute {
  readonly id: string;
  readonly version: number;
  readonly begin: Waypoint;
  readonly end: Waypoint;
  readonly geometry: ol.geom.Geometry;
}

export type RouteEvent = RouteAdded | RouteRemoved;

export type RouteEventId = string;

export interface RouteAdded {
  readonly type: "RouteAdded";
  readonly id: RouteEventId;
  readonly version: number;
  readonly startWaypointId: WaypointId; // we moeten weten waar in de volgorde van deelroutes dit thuis hoort om de lengte te kunnen meten
  readonly geometry: ol.geom.Geometry;
  readonly beginSnap: Option<Waypoint>;
  readonly endSnap: Option<Waypoint>;
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

export function routeAdded(geometryRoute: GeometryRoute, beginSnap: Option<Waypoint>, endSnap: Option<Waypoint>): RouteAdded {
  return {
    type: "RouteAdded",
    id: geometryRoute.id,
    version: geometryRoute.version,
    startWaypointId: geometryRoute.begin.id,
    geometry: geometryRoute.geometry,
    beginSnap: beginSnap,
    endSnap: endSnap
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