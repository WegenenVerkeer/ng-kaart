import { option } from "fp-ts";
import { constant, Lazy, Refinement } from "fp-ts/lib/function";

import * as clr from "../../stijl/colour";
import * as ol from "../../util/openlayers-compat";
import { RoutingService } from "./routing-service";

import { Waypoint } from "./waypoint.msg";

/// /////////////////////////////////////////////////////////////////////////////////////////
// DrawOps: Operaties op het niveau van (ver)plaatsen en verwijderen van punten op de OL map
//

// StartDrawing, StopDrawing en RedrawRoute komen van buiten de tekenen component
// AddPoint, DraggingPoint, MovePoint en DeletePoint worden gegeneerd binnen de component adhv een OL event
// EndDrawing wordt gegeneerd obv dicht bij elkaar liggen (in de tijd) van AddPoint en DeletePoint
// SnapWaypoint wordt gegeneerd obv de response van de routing service

export type DrawOps =
  | StartDrawing
  | EndDrawing
  | StopDrawing
  | RedrawRoute
  | AddPoint
  | DraggingPoint
  | MovePoint
  | DeletePoint
  | SnapWaypoint;

export type PointId = number;

export interface StartDrawing {
  readonly type: "StartDrawing";
  // voor Elisa of Davie. Wanneer we dit hier in mergen, kunnen we oude tekenen en meten componenten laten vallen
  // readonly startGeometrie: Option<ol.geom.Geometry>;
  readonly featureColour: clr.Kleur;
  readonly useRouting: boolean;
  readonly customRoutingService: option.Option<RoutingService>;
  readonly polygonStyleFunction: option.Option<ol.style.StyleFunction>;
}

// Hiermee beëindigen we de tekenmode
export interface EndDrawing {
  readonly type: "EndDrawing";
}

// Hiermee bijven we in tekenmode, maar kunnen we geen nieuwe punten meer toevoegen
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

export interface SnapWaypoint {
  readonly type: "SnapWaypoint";
  readonly waypoint: Waypoint;
}

export const StartDrawing: (
  featureColour: clr.Kleur,
  useRouting: boolean,
  customRoutingService: option.Option<RoutingService>,
  polygonStyleFunction: option.Option<ol.style.StyleFunction>
) => StartDrawing = (
  featureColour,
  useRouting,
  customRoutingService,
  polygonStyleFunction
) => ({
  type: "StartDrawing",
  featureColour: featureColour,
  useRouting: useRouting,
  customRoutingService: customRoutingService,
  polygonStyleFunction: polygonStyleFunction,
});

export const isStartDrawing: Refinement<DrawOps, StartDrawing> = (
  ops
): ops is StartDrawing => ops.type === "StartDrawing";

const endDrawing: EndDrawing = { type: "EndDrawing" };
export const EndDrawing: Lazy<EndDrawing> = constant(endDrawing);

const stopDrawing: StopDrawing = { type: "StopDrawing" };
export const StopDrawing: Lazy<StopDrawing> = constant(stopDrawing);

export const RedrawRoute: (useRouting: boolean) => RedrawRoute = (
  useRouting
) => ({
  type: "RedrawRoute",
  useRouting: useRouting,
});

export const isRedrawRoute: Refinement<DrawOps, RedrawRoute> = (
  ops
): ops is RedrawRoute => ops.type === "RedrawRoute";

export const AddPoint: (coord: ol.Coordinate) => AddPoint = (coord) => ({
  type: "AddPoint",
  coordinate: coord,
});

export const DraggingPoint: (feature: ol.Feature) => DraggingPoint = (
  feature
) => ({ type: "DraggingPoint", feature: feature });

const movePoint: MovePoint = { type: "MovePoint" };
export const MovePoint: Lazy<MovePoint> = constant(movePoint);

export const DeletePoint: (feature: ol.Feature) => DeletePoint = (feature) => ({
  type: "DeletePoint",
  feature: feature,
});

export const SnapWaypoint: (waypoint: Waypoint) => SnapWaypoint = (
  waypoint
) => ({
  type: "SnapWaypoint",
  waypoint: waypoint,
});
