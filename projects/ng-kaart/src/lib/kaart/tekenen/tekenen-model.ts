import { constant, Function1, Function2, Lazy } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";

import * as clr from "../../stijl/colour";
import { Pipeable } from "../../util";

////////////////////////////////////////////////////////////////////////////////////////////
// DrawOps: Operaties op het niveau van (ver)plaatsen en verwijderen van punten op de OL map
//

export type DrawOps = StartDrawing | StopDrawing | AddPoint | DraggingPoint | MovePoint | DeletePoint;

export type PointId = number;

export interface StartDrawing {
  readonly type: "StartDrawing";
  // readonly startGeometrie: Option<ol.geom.Geometry>;
  readonly pointColour: clr.Kleur;
}

export interface StopDrawing {
  readonly type: "StopDrawing";
}

export interface AddPoint {
  readonly type: "AddPoint";
  readonly coordinate: ol.Coordinate;
}

export interface DraggingPoint {
  readonly type: "DraggingPoint";
  readonly feature: ol.Feature;
}

export interface MovePoint {
  readonly type: "MovePoint";
}

export interface DeletePoint {
  readonly type: "DeletePoint";
  readonly feature: ol.Feature;
}

export const StartDrawing: Function1<clr.Kleur, StartDrawing> = puntKleur => ({ type: "StartDrawing", pointColour: puntKleur });

const stopDrawing: StopDrawing = { type: "StopDrawing" };
export const StopDrawing: Lazy<StopDrawing> = constant(stopDrawing);

export const AddPoint: Function1<ol.Coordinate, AddPoint> = coord => ({ type: "AddPoint", coordinate: coord });

export const DraggingPoint: Function1<ol.Feature, DraggingPoint> = feature => ({ type: "DraggingPoint", feature: feature });

const movePoint: MovePoint = { type: "MovePoint" };
export const MovePoint: Lazy<MovePoint> = constant(movePoint);

export const DeletePoint: Function1<ol.Feature, DeletePoint> = feature => ({ type: "DeletePoint", feature: feature });

////////////////////////////////////////////////////////
// WaypointsOps: operaties op het niveau van routepunten
//

export type WaypointOps = AddWaypoint | RemoveWaypoint; // TOOD hier moet Filip's type komen

export interface Waypoint {
  readonly id: number;
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

export const Waypoint: Function2<number, ol.Coordinate, Waypoint> = (id, location) => ({ id: id, location: location });

export const AddWaypoint: Function2<Option<Waypoint>, Waypoint, AddWaypoint> = (previous, waypoint) => ({
  type: "AddWaypoint",
  previous: previous,
  waypoint: waypoint
});

export const RemoveWaypoint: Function1<Waypoint, RemoveWaypoint> = waypoint => ({ type: "RemoveWaypoint", waypoint: waypoint });

/////////////////////////////////////////////////////////////////////
// RouteSegmentOps: operaties op het niveau van segementen van routes
//

export type RouteSegmentOps = AddRouteSegement | RemoveRouteSegment;

export interface AddRouteSegement {
  id: number;
  geom: ol.geom.Geometry;
}

export interface RemoveRouteSegment {
  id: number;
}

export const makeRoute: Pipeable<WaypointOps, RouteSegmentOps> = o => rx.empty();
