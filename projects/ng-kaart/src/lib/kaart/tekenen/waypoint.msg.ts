import { option } from "fp-ts";

import * as ol from "../../util/openlayers-compat";

/// /////////////////////////////////////////////////////
// WaypointsOps: operaties op het niveau van routepunten
//

export type WaypointId = number;

export type WaypointOperation = AddWaypoint | RemoveWaypoint;

export interface Waypoint {
  readonly id: WaypointId;
  readonly location: ol.Coordinate;
}

export interface AddWaypoint {
  readonly type: "AddWaypoint";
  readonly previous: option.Option<Waypoint>;
  readonly waypoint: Waypoint;
}

export interface RemoveWaypoint {
  readonly type: "RemoveWaypoint";
  readonly waypoint: Waypoint;
}

export const Waypoint: (id: WaypointId, location: ol.Coordinate) => Waypoint = (
  id,
  location
) => ({ id: id, location: location });

export const AddWaypoint: (
  previous: option.Option<Waypoint>,
  waypoint: Waypoint
) => AddWaypoint = (previous, waypoint) => ({
  type: "AddWaypoint",
  previous: previous,
  waypoint: waypoint,
});

export const RemoveWaypoint: (waypoint: Waypoint) => RemoveWaypoint = (
  waypoint
) => ({ type: "RemoveWaypoint", waypoint: waypoint });
