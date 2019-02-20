import { constant, Function1, Function2, Lazy, Refinement } from "fp-ts/lib/function";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { mergeMap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { Pipeable } from "../../util";

import { WaypointOperation } from "./waypoint.msg";

////////////////////////////////////////////////////////////////////////////////////////////
// DrawOps: Operaties op het niveau van (ver)plaatsen en verwijderen van punten op de OL map
//

export type DrawOps = StartDrawing | StopDrawing | RedrawRoute | AddPoint | DraggingPoint | MovePoint | DeletePoint;

export type PointId = number;

export interface StartDrawing {
  readonly type: "StartDrawing";
  // readonly startGeometrie: Option<ol.geom.Geometry>; --> voor Eliza of Davie
  readonly featureColour: clr.Kleur;
  readonly useRouting: boolean;
}

export interface StopDrawing {
  readonly type: "StopDrawing";
}

export interface RedrawRoute {
  readonly type: "RedrawRoute";
  readonly useRouting: boolean;
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

export const StartDrawing: Function2<clr.Kleur, boolean, StartDrawing> = (featureColour, useRouting) => ({
  type: "StartDrawing",
  featureColour: featureColour,
  useRouting: useRouting
});

export const isStartDrawing: Refinement<DrawOps, StartDrawing> = (ops): ops is StartDrawing => ops.type === "StartDrawing";

const stopDrawing: StopDrawing = { type: "StopDrawing" };
export const StopDrawing: Lazy<StopDrawing> = constant(stopDrawing);

export const RedrawRoute: Function1<boolean, RedrawRoute> = useRouting => ({ type: "RedrawRoute", useRouting: useRouting });

export const isRedrawRoute: Refinement<DrawOps, RedrawRoute> = (ops): ops is RedrawRoute => ops.type === "RedrawRoute";

export const AddPoint: Function1<ol.Coordinate, AddPoint> = coord => ({ type: "AddPoint", coordinate: coord });

export const DraggingPoint: Function1<ol.Feature, DraggingPoint> = feature => ({ type: "DraggingPoint", feature: feature });

const movePoint: MovePoint = { type: "MovePoint" };
export const MovePoint: Lazy<MovePoint> = constant(movePoint);

export const DeletePoint: Function1<ol.Feature, DeletePoint> = feature => ({ type: "DeletePoint", feature: feature });

////////////////////////////////////////////////////////////////////
// RouteSegmentOps: operaties op het niveau van segmenten van routes
//

export type RouteSegmentOps = AddRouteSegment | RemoveRouteSegment;

export interface AddRouteSegment {
  type: "AddRouteSegment";
  id: number;
  geom: ol.geom.Geometry;
}

export interface RemoveRouteSegment {
  type: "RemoveRouteSegment";
  id: number;
}

let i = 0;

export const makeRoute: Pipeable<WaypointOperation, RouteSegmentOps> = o =>
  o.pipe(
    mergeMap(ops => {
      switch (ops.type) {
        case "AddWaypoint":
          return ops.previous
            .map(first =>
              rx.of({
                type: "AddRouteSegment",
                id: i++,
                geom: new ol.geom.LineString([first.location, ops.waypoint.location])
              } as AddRouteSegment)
            )
            .getOrElse(rx.empty());
        case "RemoveWaypoint":
          return rx.empty();
      }
    })
  );
