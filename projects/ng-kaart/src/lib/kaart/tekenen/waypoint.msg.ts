import { Function1, Function2 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";

import * as ol from "../../util/openlayers-compat";

////////////////////////////////////////////////////////
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
  readonly previous: Option<Waypoint>;
  readonly waypoint: Waypoint;
}

export interface RemoveWaypoint {
  readonly type: "RemoveWaypoint";
  readonly waypoint: Waypoint;
}

export const Waypoint: Function2<WaypointId, ol.Coordinate, Waypoint> = (id, location) => ({ id: id, location: location });

export const AddWaypoint: Function2<Option<Waypoint>, Waypoint, AddWaypoint> = (previous, waypoint) => ({
  type: "AddWaypoint",
  previous: previous,
  waypoint: waypoint
});

export const RemoveWaypoint: Function1<Waypoint, RemoveWaypoint> = waypoint => ({ type: "RemoveWaypoint", waypoint: waypoint });
