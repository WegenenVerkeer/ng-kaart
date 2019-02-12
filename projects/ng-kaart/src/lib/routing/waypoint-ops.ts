import { Http } from "@angular/http";
import * as array from "fp-ts/lib/Array";
import { None, Option } from "fp-ts/lib/Option";
import * as strmap from "fp-ts/lib/StrMap";
import * as rx from "rxjs";
import { concat, Observable, Subject } from "rxjs";
import { map, mergeMap, scan } from "rxjs/operators";

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
import { Waypoint, WaypointAdded, WaypointOperation, WaypointRemoved } from "./waypoint-msg";

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

export interface RouteState {
  readonly routesBegin: strmap.StrMap<ProtoRoute>;
  readonly routesEnd: strmap.StrMap<ProtoRoute>;
}

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

export function routeStateTransition(previousState: RouteState, routeChanges: RouteChanges): RouteStateTransition {
  const routesBeginRemoved = routeChanges.routesRemoved.reduce((rbegin, r) => strmap.remove(r.begin.id, rbegin), previousState.routesBegin);
  const routesBegin = routeChanges.routesAdded.reduce((rbegin, r) => strmap.insert(r.begin.id, r, rbegin), routesBeginRemoved);

  const routesEndRemoved = routeChanges.routesRemoved.reduce((rend, r) => strmap.remove(r.end.id, rend), previousState.routesEnd);
  const routesEnd = routeChanges.routesAdded.reduce((rend, r) => strmap.insert(r.end.id, r, rend), routesEndRemoved);

  return <RouteStateTransition>{
    routeChanges: routeChanges,
    routeState: <RouteState>{
      routesBegin: routesBegin,
      routesEnd: routesEnd
    }
  };
}

export function removeWaypoint(routeState: RouteState, waypointRemoved: WaypointRemoved): RouteChanges {
  const id = waypointRemoved.waypoint.id;
  const maybeEndRoute = strmap.lookup(id, routeState.routesEnd);
  const maybeStartRoute = strmap.lookup(id, routeState.routesBegin);

  const routesRemoved = toArray(maybeEndRoute).concat(toArray(maybeStartRoute));
  const routeAdded = maybeEndRoute.chain(endRoute => maybeStartRoute.map(startRoute => createRoute(endRoute.begin, startRoute.end)));

  return <RouteChanges>{
    routesAdded: toArray(routeAdded),
    routesRemoved: routesRemoved
  };
}

export function addWaypoint(routeState: RouteState, waypointAdded: WaypointAdded): RouteChanges {
  return waypointAdded.previous.fold(
    <RouteChanges>{
      routesAdded: [],
      routesRemoved: []
    },
    previous => {
      const maybeStartRoute = strmap.lookup(previous.id, routeState.routesBegin);
      const routeAdded = createRoute(previous, waypointAdded.waypoint);

      return <RouteChanges>{
        routesAdded: [routeAdded],
        routesRemoved: toArray(maybeStartRoute)
      };
    }
  );
}

function nextRouteStateChanges(previous: RouteStateTransition, waypointOperation: WaypointOperation): RouteStateTransition {
  switch (waypointOperation.type) {
    case "WaypointRemoved": {
      const routeChanges = removeWaypoint(previous.routeState, <WaypointRemoved>waypointOperation);
      return routeStateTransition(previous.routeState, routeChanges);
    }
    case "WaypointAdded": {
      const routeChanges = addWaypoint(previous.routeState, <WaypointAdded>waypointOperation);
      return routeStateTransition(previous.routeState, routeChanges);
    }
  }
}

export function directeRoutes(): Pipeable<WaypointOperation, RouteOperation> {
  return waypointOperationToRouteOperation(new SimpleRoutingService());
}

export function routesViaRoutering(http: Http): Pipeable<WaypointOperation, RouteOperation> {
  return waypointOperationToRouteOperation(new CompositeRoutingService([this.simpleRoutingService, new VerfijndeRoutingService(http)]));
}

const waypointOperationToRouteOperation = (routingService: RoutingService) => (waypointOperations: Observable<WaypointOperation>) => {
  const routeStateChangesObs = waypointOperations.pipe(scan(nextRouteStateChanges));

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
