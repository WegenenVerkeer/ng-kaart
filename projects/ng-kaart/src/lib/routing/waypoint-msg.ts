import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";

export interface Waypoint {
  readonly id: string;
  readonly coordinate: ol.Coordinate;
}

export function waypoint(id: number, coordinate: ol.Coordinate): Waypoint {
  return <Waypoint>{
    id: id.toString(),
    coordinate: coordinate
  };
}

export interface WaypointAdded {
  readonly type: "WaypointAdded";
  readonly previous: Option<Waypoint>;
  readonly waypoint: Waypoint;
}

export function waypointAdded(previous: Option<Waypoint>, waypoint: Waypoint): WaypointAdded {
  return <WaypointAdded>{
    previous: previous,
    waypoint: waypoint
  };
}

export interface WaypointRemoved {
  readonly type: "WaypointRemoved";
  readonly waypoint: Waypoint;
}

export type WaypointOperation = WaypointAdded | WaypointRemoved;
