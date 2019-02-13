import { Http } from "@angular/http";
import * as array from "fp-ts/lib/Array";
import { none, None, Option, some } from "fp-ts/lib/Option";
import * as strmap from "fp-ts/lib/StrMap";
import * as rx from "rxjs";
import { map, mergeMap, scan } from "rxjs/operators";

import * as arrays from "../util/arrays";
import { Pipeable } from "../util/operators";
import { toArray } from "../util/option";

import {
  CompositeRoutingService,
  ProtoRoute,
  RoutingService,
  SimpleRoutingService,
  VerfijndeRoute,
  VerfijndeRoutingService
} from "./routing-service";
import { Waypoint, WaypointAdded, waypointAdded, WaypointOperation, WaypointRemoved } from "./waypoint-msg";

export interface RouteAdded {
  readonly type: "RouteAdded";
  readonly id: string;
  readonly geometry: ol.geom.Geometry;
}

function routeAdded(verfijndeRoute: VerfijndeRoute): RouteAdded {
  return <RouteAdded>{
    id: verfijndeRoute.id,
    geometry: verfijndeRoute.geometry
  };
}

export interface RouteRemoved {
  readonly type: "RouteRemoved";
  readonly id: string;
}

function routeRemoved(protoRoute: ProtoRoute): RouteRemoved {
  return <RouteRemoved>{
    id: protoRoute.id
  };
}

export type RouteOperation = RouteAdded | RouteRemoved;

export type RouteState = Array<Waypoint>;

export interface RouteChanges {
  readonly routesAdded: Array<ProtoRoute>;
  readonly routesRemoved: Array<ProtoRoute>;
}

interface RouteStateTransition {
  readonly routeState: RouteState;
  readonly routeChanges: RouteChanges;
}

function createRoute(begin: Waypoint, end: Waypoint): ProtoRoute {
  return <ProtoRoute>{
    id: begin.id + "_" + end.id,
    begin: begin,
    end: end
  };
}

export function removeWaypoint(routeState: RouteState, waypointRemoved: WaypointRemoved): RouteStateTransition {
  const id = waypointRemoved.waypoint.id;

  const maybePreviousWaypoint = arrays.previousElement(routeState)(wp => wp.id === id);
  const maybeNextWaypoint = arrays.nextElement(routeState)(wp => wp.id === id);

  const maybeBeginRoute = maybePreviousWaypoint.map(begin => createRoute(begin, waypointRemoved.waypoint));
  const maybeEndRoute = maybeNextWaypoint.map(end => createRoute(waypointRemoved.waypoint, end));

  const routesRemoved = toArray(maybeEndRoute).concat(toArray(maybeBeginRoute));
  const routeAdded = maybePreviousWaypoint.chain(pwp => maybeNextWaypoint.map(nwp => createRoute(pwp, nwp)));

  return <RouteStateTransition>{
    routeChanges: <RouteChanges>{
      routesAdded: toArray(routeAdded),
      routesRemoved: routesRemoved
    },
    routeState: arrays
      .deleteFirst(routeState)(wp => wp.id === waypointRemoved.waypoint.id)
      .getOrElse(routeState)
  };
}

export function addWaypoint(routeState: RouteState, waypointAdded: WaypointAdded): RouteStateTransition {
  return waypointAdded.previous.fold(
    <RouteStateTransition>{
      routeChanges: <RouteChanges>{
        routesAdded: [],
        routesRemoved: []
      },
      routeState: [waypointAdded.waypoint]
    },
    previous => {
      const maybeOldNextWaypoint = arrays.nextElement(routeState)(wp => wp.id === previous.id);
      const maybeRouteToRemove = maybeOldNextWaypoint.map(end => createRoute(previous, end));

      const routeAdded = createRoute(previous, waypointAdded.waypoint);
      const routesAdded = toArray(maybeOldNextWaypoint.map(end => createRoute(waypointAdded.waypoint, end)));
      routesAdded.push(routeAdded);

      return <RouteStateTransition>{
        routeChanges: <RouteChanges>{
          routesAdded: routesAdded,
          routesRemoved: toArray(maybeRouteToRemove)
        },
        routeState: arrays
          .insertAfter(routeState)(wp => wp.id === previous.id)(waypointAdded.waypoint)
          .getOrElse(routeState)
      };
    }
  );
}

function nextRouteStateChanges(previous: RouteStateTransition, waypointOperation: WaypointOperation): RouteStateTransition {
  switch (waypointOperation.type) {
    case "WaypointRemoved": {
      return removeWaypoint(previous.routeState, <WaypointRemoved>waypointOperation);
    }
    case "WaypointAdded": {
      return addWaypoint(previous.routeState, <WaypointAdded>waypointOperation);
    }
  }
}

export function directeRoutes(): Pipeable<WaypointOperation, RouteOperation> {
  return waypointOperationToRouteOperation(new SimpleRoutingService());
}

export function routesViaRoutering(http: Http): Pipeable<WaypointOperation, RouteOperation> {
  return waypointOperationToRouteOperation(new CompositeRoutingService([this.simpleRoutingService, new VerfijndeRoutingService(http)]));
}

const waypointOperationToRouteOperation = (routingService: RoutingService) => (waypointOperations: rx.Observable<WaypointOperation>) => {
  const routeStateChangesObs: rx.Observable<RouteStateTransition> = waypointOperations.pipe(scan(nextRouteStateChanges));

  const deleteOperations = routeStateChangesObs.pipe(
    mergeMap(changes => rx.concat(changes.routeChanges.routesRemoved)),
    map(routeRemoved)
  );

  const addOperations = routeStateChangesObs.pipe(
    mergeMap(changes => rx.concat(changes.routeChanges.routesAdded)),
    mergeMap(protoRoute => routingService.resolve(protoRoute)),
    map(routeAdded)
  );

  return rx.concat(deleteOperations, addOperations);
};
