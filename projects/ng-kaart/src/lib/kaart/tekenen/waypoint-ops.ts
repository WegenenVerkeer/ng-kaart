import { HttpClient } from "@angular/common/http";
import * as array from "fp-ts/lib/Array";
import { concat, Function1 } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { map, mergeMap, scan } from "rxjs/operators";

import * as arrays from "../../util/arrays";
import { Pipeable, subSpy } from "../../util/operators";
import { toArray } from "../../util/option";

import { ProtoRoute, RouteAdded, RouteEvent, RouteRemoved } from "./route.msg";
import { CompositeRoutingService, RoutingService, SimpleRoutingService, VerfijndeRoutingService } from "./routing-service";
import { AddWaypoint, RemoveWaypoint, Waypoint, WaypointOperation } from "./waypoint.msg";

export type RouteState = Array<Waypoint>;

export interface RouteChanges {
  readonly routesAdded: Array<ProtoRoute>;
  readonly routesRemoved: Array<ProtoRoute>;
}

interface RouteStateTransition {
  readonly routeState: RouteState;
  readonly routeChanges: RouteChanges;
}

const initialRouteStateTransition: RouteStateTransition = {
  routeState: [],
  routeChanges: {
    routesAdded: [],
    routesRemoved: []
  }
};

function createRoute(begin: Waypoint, end: Waypoint): ProtoRoute {
  return {
    id: `${begin.id}_${end.id}`,
    begin: begin,
    end: end
  };
}

export function removeWaypoint(routeState: RouteState, RemoveWaypoint: RemoveWaypoint): RouteStateTransition {
  const id = RemoveWaypoint.waypoint.id;

  const maybePreviousWaypoint = arrays.previousElement(routeState)(wp => wp.id === id);
  const maybeNextWaypoint = arrays.nextElement(routeState)(wp => wp.id === id);

  const maybeBeginRoute = maybePreviousWaypoint.map(begin => createRoute(begin, RemoveWaypoint.waypoint));
  const maybeEndRoute = maybeNextWaypoint.map(end => createRoute(RemoveWaypoint.waypoint, end));

  const routesRemoved = concat(toArray(maybeEndRoute), toArray(maybeBeginRoute));
  const routeAdded = maybePreviousWaypoint.chain(pwp => maybeNextWaypoint.map(nwp => createRoute(pwp, nwp)));

  return {
    routeChanges: {
      routesAdded: toArray(routeAdded),
      routesRemoved: routesRemoved
    },
    routeState: arrays
      .deleteFirst(routeState)(wp => wp.id === RemoveWaypoint.waypoint.id)
      .getOrElse(routeState)
  };
}

export function addWaypoint(routeState: RouteState, addWaypoint: AddWaypoint): RouteStateTransition {
  return addWaypoint.previous.fold(
    {
      routeChanges: {
        routesAdded: toArray(array.head(routeState).map(e => createRoute(addWaypoint.waypoint, e))),
        routesRemoved: []
      },
      routeState: [addWaypoint.waypoint].concat(routeState)
    },
    previous => {
      const maybeOldNextWaypoint = arrays.nextElement(routeState)(wp => wp.id === previous.id);
      const maybeRouteToRemove = maybeOldNextWaypoint.map(end => createRoute(previous, end));

      const routeAdded = createRoute(previous, addWaypoint.waypoint);
      const routesAdded = toArray(maybeOldNextWaypoint.map(end => createRoute(addWaypoint.waypoint, end)));
      routesAdded.push(routeAdded);

      return {
        routeChanges: {
          routesAdded: routesAdded,
          routesRemoved: toArray(maybeRouteToRemove)
        },
        routeState: arrays
          .insertAfter(routeState)(wp => wp.id === previous.id)(addWaypoint.waypoint)
          .getOrElse(routeState)
      };
    }
  );
}

function nextRouteStateChanges(previous: RouteStateTransition, waypointOps: WaypointOperation): RouteStateTransition {
  switch (waypointOps.type) {
    case "RemoveWaypoint":
      return removeWaypoint(previous.routeState, waypointOps);

    case "AddWaypoint":
      return addWaypoint(previous.routeState, waypointOps);
  }
}

export function directeRoutes(): Pipeable<WaypointOperation, RouteEvent> {
  return waypointOpsToRouteOperation(new SimpleRoutingService());
}

export function routesViaRoutering(http: HttpClient): Pipeable<WaypointOperation, RouteEvent> {
  return waypointOpsToRouteOperation(new CompositeRoutingService([new SimpleRoutingService(), new VerfijndeRoutingService(http)]));
}

const waypointOpsToRouteOperation: Function1<RoutingService, Pipeable<WaypointOperation, RouteEvent>> = routingService => waypointOpss => {
  const routeStateChangesObs: rx.Observable<RouteStateTransition> = subSpy("****routeStateChanges")(
    waypointOpss.pipe(scan(nextRouteStateChanges, initialRouteStateTransition))
  );

  return routeStateChangesObs.pipe(
    mergeMap(changes =>
      rx.concat(
        rx.from(changes.routeChanges.routesRemoved).pipe(map(removal => RouteRemoved(removal.id, removal.begin.id))),
        rx.from(changes.routeChanges.routesAdded).pipe(
          mergeMap(protoRoute => routingService.resolve(protoRoute)),
          map(addition => RouteAdded(addition.id, addition.begin.id, addition.geometry))
        )
      )
    )
  );
};
