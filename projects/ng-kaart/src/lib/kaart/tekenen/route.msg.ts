import { Option } from "fp-ts/lib/Option";

import { Waypoint, WaypointId } from "./waypoint.msg";

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

export type RouteEventId = string;

export type RouteEvent = RouteAdded | RouteRemoved;

export interface RouteAdded {
  readonly type: "RouteAdded";
  readonly id: RouteEventId;
  readonly startWaypointId: WaypointId; // we moeten weten waar in de volgorde van deelroutes dit thuis hoort om de lengte te kunnen meten
  readonly geometry: ol.geom.Geometry;
}

export function RouteAdded(id: RouteEventId, startWaypointId: WaypointId, geometry: ol.geom.Geometry): RouteAdded {
  return {
    type: "RouteAdded",
    id: id,
    startWaypointId: startWaypointId,
    geometry: geometry
  };
}

export interface RouteRemoved {
  readonly type: "RouteRemoved";
  readonly id: RouteEventId;
  readonly startWaypointId: WaypointId;
}

export function RouteRemoved(id: RouteEventId, startWaypointId: WaypointId): RouteRemoved {
  return {
    type: "RouteRemoved",
    id: id,
    startWaypointId: startWaypointId
  };
}
