import { HttpClient } from "@angular/common/http";
import * as array from "fp-ts/lib/Array";
import { concat, Function1, Function2 } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as strmap from "fp-ts/lib/StrMap";
import { Tuple } from "fp-ts/lib/Tuple";
import * as rx from "rxjs";
import { map, mergeMap } from "rxjs/operators";

import { Coordinate } from "../../coordinaten";
import * as arrays from "../../util/arrays";
import { catOptions, Pipeable, scanState } from "../../util/operators";
import { toArray } from "../../util/option";

import { createRoute, ProtoRoute, routeAdded, RouteEvent, routeRemoved } from "./route.msg";
import { CompositeRoutingService, RoutingService, SimpleRoutingService, VerfijndeRoutingService } from "./routing-service";
import { AddWaypoint, RemoveWaypoint, Waypoint, WaypointOperation } from "./waypoint.msg";

export type Versions = strmap.StrMap<number>;

function updateVersions(versions: Versions, protoRoutes: Array<ProtoRoute>): Versions {
  return protoRoutes.reduce((acc, pr) => strmap.insert(pr.id, pr.version, acc), versions);
}

export interface RouteState {
  readonly waypoints: Array<Waypoint>;
  readonly versions: Versions;
}

export interface RouteChanges {
  readonly routesAdded: Array<ProtoRoute>;
  readonly routesRemoved: Array<ProtoRoute>;
}

export const emptyRouteState: RouteState = { waypoints: [], versions: new strmap.StrMap<number>({}) };

export const emptyRouteChanges: RouteChanges = { routesAdded: [], routesRemoved: [] };

export function removeWaypoint(routeState: RouteState, RemoveWaypoint: RemoveWaypoint): Tuple<RouteState, RouteChanges> {
  const id = RemoveWaypoint.waypoint.id;

  const maybePreviousWaypoint = arrays.previousElement(routeState.waypoints)(wp => wp.id === id);
  const maybeNextWaypoint = arrays.nextElement(routeState.waypoints)(wp => wp.id === id);

  const maybeBeginRoute = maybePreviousWaypoint.map(begin => createRoute(begin, RemoveWaypoint.waypoint, routeState.versions));
  const maybeEndRoute = maybeNextWaypoint.map(end => createRoute(RemoveWaypoint.waypoint, end, routeState.versions));

  const routesRemoved = concat(toArray(maybeEndRoute), toArray(maybeBeginRoute));
  const routeAdded = maybePreviousWaypoint.chain(pwp => maybeNextWaypoint.map(nwp => createRoute(pwp, nwp, routeState.versions)));
  const routesAdded = toArray(routeAdded);

  return new Tuple(
    {
      waypoints: arrays
        .deleteFirst(routeState.waypoints)(wp => wp.id === RemoveWaypoint.waypoint.id)
        .getOrElse(routeState.waypoints),
      versions: updateVersions(routeState.versions, concat(routesRemoved, routesAdded))
    },
    {
      routesAdded: routesAdded,
      routesRemoved: routesRemoved
    }
  );
}

export function addWaypoint(routeState: RouteState, addWaypoint: AddWaypoint): Tuple<RouteState, RouteChanges> {
  return addWaypoint.previous.foldL(
    () => {
      const routesAdded = toArray(array.head(routeState.waypoints).map(e => createRoute(addWaypoint.waypoint, e, routeState.versions)));

      return new Tuple(
        {
          waypoints: [addWaypoint.waypoint].concat(routeState.waypoints),
          versions: updateVersions(routeState.versions, routesAdded)
        },
        {
          routesAdded: routesAdded,
          routesRemoved: []
        }
      );
    },
    previous => {
      const maybeOldNextWaypoint = arrays.nextElement(routeState.waypoints)(wp => wp.id === previous.id);
      const maybeRouteToRemove = maybeOldNextWaypoint.map(end => createRoute(previous, end, routeState.versions));

      const routeAdded = createRoute(previous, addWaypoint.waypoint, routeState.versions);
      const routesAdded = toArray(maybeOldNextWaypoint.map(end => createRoute(addWaypoint.waypoint, end, routeState.versions)));
      routesAdded.push(routeAdded);

      const routesRemoved = toArray(maybeRouteToRemove);

      return new Tuple(
        {
          waypoints: arrays
            .insertAfter(routeState.waypoints)(wp => wp.id === previous.id)(addWaypoint.waypoint)
            .getOrElse(routeState.waypoints),
          versions: updateVersions(routeState.versions, concat(routesRemoved, routesAdded))
        },
        {
          routesAdded: routesAdded,
          routesRemoved: toArray(maybeRouteToRemove)
        }
      );
    }
  );
}

function nextRouteStateChanges(previousRouteState: RouteState, waypointOps: WaypointOperation): Tuple<RouteState, RouteChanges> {
  switch (waypointOps.type) {
    case "RemoveWaypoint":
      return removeWaypoint(previousRouteState, waypointOps);

    case "AddWaypoint":
      return addWaypoint(previousRouteState, waypointOps);
  }
}

export function directeRoutes(): Pipeable<WaypointOperation, RouteEvent> {
  return waypointOpsToRouteOperation(new SimpleRoutingService());
}

export function routesViaRoutering(http: HttpClient): Pipeable<WaypointOperation, RouteEvent> {
  return waypointOpsToRouteOperation(new CompositeRoutingService([new SimpleRoutingService(), new VerfijndeRoutingService(http)]));
}

const ifDifferentLocation: Function2<ol.Coordinate, Waypoint, Option<Waypoint>> = (l, w) =>
  Coordinate.equalTo(w.location)(l) ? none : some(Waypoint(w.id, l));

const waypointOpsToRouteOperation: Function1<RoutingService, Pipeable<WaypointOperation, RouteEvent>> = routingService => waypointOpss => {
  const routeChangesObs: rx.Observable<RouteChanges> = scanState(waypointOpss, nextRouteStateChanges, emptyRouteState, emptyRouteChanges);

  const routeEventObs = routeChangesObs.pipe(
    mergeMap(routeChanges =>
      rx.concat(
        rx.from(routeChanges.routesRemoved).pipe(map(routeRemoved)),
        rx.from(routeChanges.routesAdded).pipe(
          mergeMap(protoRoute => routingService.resolve(protoRoute)),
          map(geomRoute => {
            const newBegin = geomRoute.geometry.getClosestPoint(geomRoute.begin.location);
            const newEnd = geomRoute.geometry.getClosestPoint(geomRoute.end.location);
            const beginSnap = ifDifferentLocation(newBegin, geomRoute.begin);
            const endSnap = ifDifferentLocation(newEnd, geomRoute.end);
            return routeAdded(geomRoute, beginSnap, endSnap);
          })
        )
      )
    )
  );

  return catOptions(scanState(routeEventObs, filterRouteEvent, new strmap.StrMap<number>({}), none));
};

function filterRouteEvent(versions: Versions, routeEvent: RouteEvent): Tuple<Versions, Option<RouteEvent>> {
  return strmap
    .lookup(routeEvent.id, versions)
    .fold(new Tuple(strmap.insert(routeEvent.id, routeEvent.version, versions), some(routeEvent)), previousVersion => {
      return previousVersion > routeEvent.version
        ? new Tuple(versions, none)
        : new Tuple(strmap.insert(routeEvent.id, routeEvent.version, versions), some(routeEvent));
    });
}
