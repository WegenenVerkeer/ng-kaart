import { HttpClient } from "@angular/common/http";
import { array, option, record } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { map, mergeMap } from "rxjs/operators";

import { Coordinates } from "../../coordinaten";
import * as arrays from "../../util/arrays";
import * as ol from "../../util/openlayers-compat";
import { catOptions, Pipeable, scanState } from "../../util/operators";
import { toArray } from "../../util/option";

import {
  createRoute,
  ProtoRoute,
  routeAdded,
  RouteEvent,
  routeRemoved,
} from "./route.msg";
import {
  CompositeRoutingService,
  RoutingService,
  SimpleRoutingService,
  VerfijndeRoutingService,
  WegEdge,
} from "./routing-service";
import {
  AddWaypoint,
  RemoveWaypoint,
  Waypoint,
  WaypointOperation,
} from "./waypoint.msg";

export type Versions = Record<string, number>;

function updateVersions(
  versions: Versions,
  protoRoutes: Array<ProtoRoute>
): Versions {
  return protoRoutes.reduce(
    (acc, pr) => record.insertAt(pr.id, pr.version)(acc),
    versions
  );
}

export interface RouteState {
  readonly waypoints: Array<Waypoint>;
  readonly versions: Versions;
}

export interface RouteChanges {
  readonly routesAdded: Array<ProtoRoute>;
  readonly routesRemoved: Array<ProtoRoute>;
}

export const emptyRouteState: RouteState = {
  waypoints: [],
  versions: {},
};

export const emptyRouteChanges: RouteChanges = {
  routesAdded: [],
  routesRemoved: [],
};

export function removeWaypoint(
  routeState: RouteState,
  RemoveWaypoint: RemoveWaypoint
): [RouteState, RouteChanges] {
  const id = RemoveWaypoint.waypoint.id;

  const maybePreviousWaypoint = arrays.previousElement(routeState.waypoints)(
    (wp) => wp.id === id
  );
  const maybeNextWaypoint = arrays.nextElement(routeState.waypoints)(
    (wp) => wp.id === id
  );

  const maybeBeginRoute = option.map((begin: Waypoint) =>
    createRoute(begin, RemoveWaypoint.waypoint, routeState.versions)
  )(maybePreviousWaypoint);
  const maybeEndRoute = option.map((end: Waypoint) =>
    createRoute(RemoveWaypoint.waypoint, end, routeState.versions)
  )(maybeNextWaypoint);

  const routesRemoved = toArray(maybeEndRoute).concat(toArray(maybeBeginRoute));
  const routeAdded = option.chain((pwp: Waypoint) =>
    option.map((nwp: Waypoint) => createRoute(pwp, nwp, routeState.versions))(
      maybeNextWaypoint
    )
  )(maybePreviousWaypoint);
  const routesAdded = toArray(routeAdded);

  return [
    {
      waypoints: pipe(
        arrays.deleteFirst(routeState.waypoints)(
          (wp) => wp.id === RemoveWaypoint.waypoint.id
        ),
        option.getOrElse(() => routeState.waypoints)
      ),
      versions: updateVersions(
        routeState.versions,
        routesRemoved.concat(routesAdded)
      ),
    },
    {
      routesAdded: routesAdded,
      routesRemoved: routesRemoved,
    },
  ];
}

export function addWaypoint(
  routeState: RouteState,
  addWaypoint: AddWaypoint
): [RouteState, RouteChanges] {
  return option.fold(
    () => {
      const routesAdded: ProtoRoute[] = toArray(
        pipe(
          array.head(routeState.waypoints),
          option.map((e) =>
            createRoute(addWaypoint.waypoint, e, routeState.versions)
          )
        )
      );

      const newRouteState: RouteState = {
        waypoints: [addWaypoint.waypoint].concat(routeState.waypoints),
        versions: updateVersions(routeState.versions, routesAdded),
      };

      const routeChanges: RouteChanges = {
        routesAdded: routesAdded,
        routesRemoved: [],
      };

      const res: [RouteState, RouteChanges] = [newRouteState, routeChanges];
      return res;
    },
    (previous: Waypoint) => {
      const maybeOldNextWaypoint = arrays.nextElement(routeState.waypoints)(
        (wp: Waypoint) => wp.id === previous.id
      );
      const maybeRouteToRemove = option.map((end: Waypoint) =>
        createRoute(previous, end, routeState.versions)
      )(maybeOldNextWaypoint);

      const routeAdded = createRoute(
        previous,
        addWaypoint.waypoint,
        routeState.versions
      );
      const routesAdded: ProtoRoute[] = toArray(
        option.map((end: Waypoint) =>
          createRoute(addWaypoint.waypoint, end, routeState.versions)
        )(maybeOldNextWaypoint)
      );
      routesAdded.push(routeAdded);

      const routesRemoved: ProtoRoute[] = toArray(maybeRouteToRemove);

      const newRouteState: RouteState = {
        waypoints: pipe(
          arrays.insertAfter(routeState.waypoints)(
            (wp) => wp.id === previous.id
          )(addWaypoint.waypoint),
          option.getOrElse(() => routeState.waypoints)
        ),
        versions: updateVersions(
          routeState.versions,
          routesRemoved.concat(routesAdded)
        ),
      };

      const routeChanges: RouteChanges = {
        routesAdded: routesAdded,
        routesRemoved: toArray(maybeRouteToRemove),
      };

      const res: [RouteState, RouteChanges] = [newRouteState, routeChanges];
      return res;
    }
  )(addWaypoint.previous);
}

function nextRouteStateChanges(
  previousRouteState: RouteState,
  waypointOps: WaypointOperation
): [RouteState, RouteChanges] {
  switch (waypointOps.type) {
    case "RemoveWaypoint":
      return removeWaypoint(previousRouteState, waypointOps);

    case "AddWaypoint":
      return addWaypoint(previousRouteState, waypointOps);
  }
}

export function directeRoutes<Edge>(): Pipeable<
  WaypointOperation,
  RouteEvent<Edge>
> {
  return waypointOpsToRouteOperation(new SimpleRoutingService());
}

export function routesViaRoutering<Edge>(
  http: HttpClient
): Pipeable<WaypointOperation, RouteEvent<Edge>> {
  return waypointOpsToRouteOperation(
    new CompositeRoutingService([
      new SimpleRoutingService(),
      new VerfijndeRoutingService(http),
    ])
  );
}

export function customRoutes<Edge>(
  customRoutingService: RoutingService<Edge>
): Pipeable<WaypointOperation, RouteEvent<Edge>> {
  return waypointOpsToRouteOperation(
    new CompositeRoutingService([
      new SimpleRoutingService(),
      customRoutingService,
    ])
  );
}

const ifDifferentLocation: (
  l: ol.Coordinate,
  w: Waypoint
) => option.Option<Waypoint> = (l, w) =>
  Coordinates.equalTo(w.location)(l)
    ? option.none
    : option.some(Waypoint(w.id, l));

const waypointOpsToRouteOperation: <Edge>(
  routingService: RoutingService<Edge>
) => Pipeable<WaypointOperation, RouteEvent<Edge>> = (routingService) => (
  waypointOpss
) => {
  const routeChangesObs: rx.Observable<RouteChanges> = scanState(
    waypointOpss,
    nextRouteStateChanges,
    emptyRouteState,
    emptyRouteChanges
  );

  const routeEventObs = routeChangesObs.pipe(
    mergeMap((routeChanges) =>
      rx.concat(
        rx.from(routeChanges.routesRemoved).pipe(map(routeRemoved)),
        rx.from(routeChanges.routesAdded).pipe(
          mergeMap((protoRoute) => routingService.resolve(protoRoute)),
          map((geomRoute) => {
            const newBegin = geomRoute.geometry.getClosestPoint(
              geomRoute.begin.location
            );
            const newEnd = geomRoute.geometry.getClosestPoint(
              geomRoute.end.location
            );
            const beginSnap = ifDifferentLocation(newBegin, geomRoute.begin);
            const endSnap = ifDifferentLocation(newEnd, geomRoute.end);
            return routeAdded(geomRoute, beginSnap, endSnap);
          })
        )
      )
    )
  );

  return catOptions(
    scanState(routeEventObs, filterRouteEvent, {}, option.none)
  );
};

function filterRouteEvent<Edge>(
  versions: Versions,
  routeEvent: RouteEvent<Edge>
): [Versions, option.Option<RouteEvent<Edge>>] {
  return pipe(
    record.lookup(routeEvent.id, versions),
    option.fold(
      () => [
        record.insertAt(routeEvent.id, routeEvent.version)(versions),
        option.some(routeEvent),
      ],
      (previousVersion) => {
        return previousVersion > routeEvent.version
          ? [versions, option.none]
          : [
              record.insertAt(routeEvent.id, routeEvent.version)(versions),
              option.some(routeEvent),
            ];
      }
    )
  );
}
