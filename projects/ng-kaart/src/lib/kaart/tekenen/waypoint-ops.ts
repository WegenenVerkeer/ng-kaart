import { HttpClient } from "@angular/common/http";
import * as array from "fp-ts/lib/Array";
import { concat, Function1 } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as strmap from "fp-ts/lib/StrMap";
import * as rx from "rxjs";
import { map, mergeMap, scan } from "rxjs/operators";

import * as arrays from "../../util/arrays";
import { Pipeable, subSpy } from "../../util/operators";
import { toArray } from "../../util/option";

import { createRoute, ProtoRoute, routeAdded, RouteEvent, routeRemoved } from "./route.msg";
import { CompositeRoutingService, RoutingService, SimpleRoutingService, VerfijndeRoutingService } from "./routing-service";
import { AddWaypoint, RemoveWaypoint, Waypoint, WaypointOperation } from "./waypoint.msg";

export type Versions = strmap.StrMap<number>;

function updateVersions(versions: Versions, protoRoutes: Array<ProtoRoute>): Versions {
  return protoRoutes.reduce((acc, pr) => strmap.insert(pr.id, pr.version, acc), versions);
}

export interface RouteState {
  waypoints: Array<Waypoint>;
  versions: Versions;
}

export interface RouteChanges {
  readonly routesAdded: Array<ProtoRoute>;
  readonly routesRemoved: Array<ProtoRoute>;
}

interface RouteStateTransition {
  readonly routeState: RouteState;
  readonly routeChanges: RouteChanges;
}

const initialRouteStateTransition: RouteStateTransition = {
  routeState: {
    waypoints: [],
    versions: new strmap.StrMap<number>({})
  },
  routeChanges: {
    routesAdded: [],
    routesRemoved: []
  }
};

export function removeWaypoint(routeState: RouteState, RemoveWaypoint: RemoveWaypoint): RouteStateTransition {
  const id = RemoveWaypoint.waypoint.id;

  const maybePreviousWaypoint = arrays.previousElement(routeState.waypoints)(wp => wp.id === id);
  const maybeNextWaypoint = arrays.nextElement(routeState.waypoints)(wp => wp.id === id);

  const maybeBeginRoute = maybePreviousWaypoint.map(begin => createRoute(begin, RemoveWaypoint.waypoint, routeState.versions));
  const maybeEndRoute = maybeNextWaypoint.map(end => createRoute(RemoveWaypoint.waypoint, end, routeState.versions));

  const routesRemoved = concat(toArray(maybeEndRoute), toArray(maybeBeginRoute));
  const routeAdded = maybePreviousWaypoint.chain(pwp => maybeNextWaypoint.map(nwp => createRoute(pwp, nwp, routeState.versions)));
  const routesAdded = toArray(routeAdded);

  return {
    routeChanges: {
      routesAdded: routesAdded,
      routesRemoved: routesRemoved
    },
    routeState: {
      waypoints: arrays
        .deleteFirst(routeState.waypoints)(wp => wp.id === RemoveWaypoint.waypoint.id)
        .getOrElse(routeState.waypoints),
      versions: updateVersions(routeState.versions, concat(routesRemoved, routesAdded))
    }
  };
}

export function addWaypoint(routeState: RouteState, addWaypoint: AddWaypoint): RouteStateTransition {
  return addWaypoint.previous.foldL(
    () => {
      const routesAdded = toArray(array.head(routeState.waypoints).map(e => createRoute(addWaypoint.waypoint, e, routeState.versions)));

      return {
        routeChanges: {
          routesAdded: routesAdded,
          routesRemoved: []
        },
        routeState: {
          waypoints: [addWaypoint.waypoint].concat(routeState.waypoints),
          versions: updateVersions(routeState.versions, routesAdded)
        }
      };
    },
    previous => {
      const maybeOldNextWaypoint = arrays.nextElement(routeState.waypoints)(wp => wp.id === previous.id);
      const maybeRouteToRemove = maybeOldNextWaypoint.map(end => createRoute(previous, end, routeState.versions));

      const routeAdded = createRoute(previous, addWaypoint.waypoint, routeState.versions);
      const routesAdded = toArray(maybeOldNextWaypoint.map(end => createRoute(addWaypoint.waypoint, end, routeState.versions)));
      routesAdded.push(routeAdded);

      const routesRemoved = toArray(maybeRouteToRemove);

      return {
        routeChanges: {
          routesAdded: routesAdded,
          routesRemoved: toArray(maybeRouteToRemove)
        },
        routeState: {
          waypoints: arrays
            .insertAfter(routeState.waypoints)(wp => wp.id === previous.id)(addWaypoint.waypoint)
            .getOrElse(routeState.waypoints),
          versions: updateVersions(routeState.versions, concat(routesRemoved, routesAdded))
        }
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

  const routeEventObs = routeStateChangesObs.pipe(
    mergeMap(changes =>
      rx.concat(
        rx.from(changes.routeChanges.routesRemoved).pipe(map(routeRemoved)),
        rx.from(changes.routeChanges.routesAdded).pipe(
          mergeMap(protoRoute => routingService.resolve(protoRoute)),
          map(routeAdded)
        )
      )
    )
  );

  const filteredRouteEventObs = subSpy("****filteredRouteEvent")(routeEventObs.pipe(scan(filterRouteEvent, initialFilteredRouteEvent)));

  return filteredRouteEventObs.pipe(mergeMap(filteredRouteEvent => filteredRouteEvent.routeEvent.fold(rx.empty(), re => rx.of(re))));
};

interface FilteredRouteEvent {
  versions: Versions;
  routeEvent: Option<RouteEvent>;
}

const initialFilteredRouteEvent: FilteredRouteEvent = {
  versions: new strmap.StrMap<number>({}),
  routeEvent: none
};

function filterRouteEvent(filteredRouteEvent: FilteredRouteEvent, routeEvent: RouteEvent): FilteredRouteEvent {
  return strmap.lookup(routeEvent.id, filteredRouteEvent.versions).fold(
    {
      versions: strmap.insert(routeEvent.id, routeEvent.version, filteredRouteEvent.versions),
      routeEvent: some(routeEvent)
    },
    previousVersion => {
      return previousVersion > routeEvent.version
        ? {
            versions: filteredRouteEvent.versions,
            routeEvent: none
          }
        : {
            versions: strmap.insert(routeEvent.id, routeEvent.version, filteredRouteEvent.versions),
            routeEvent: some(routeEvent)
          };
    }
  );
}
