import { None, none, Option } from "fp-ts/lib/Option";
import * as strmap from "fp-ts/lib/StrMap";
import * as ol from "openlayers";

import { waypoint, waypointAdded } from "./waypoint-msg";
import { addWaypoint, RouteState, routeStateTransition } from "./waypoint-ops";

describe("Route Changes", () => {
  describe("Wanneer een eerste waypoint toegevoegd wordt", () => {
    it("moeten er geen nieuw routes zijn", () => {
      const beginState = emptyRouteState();
      const transition1 = routeStateTransition(beginState, addWaypoint(beginState, waypointAdded(none, waypoint(1, [0, 0]))));
      expect(transition1.routeChanges.routesRemoved.length).toBe(0);
      expect(transition1.routeChanges.routesAdded.length).toBe(0);
      expect(strmap.isEmpty(transition1.routeState.routesBegin));
      expect(strmap.isEmpty(transition1.routeState.routesEnd));
    });
  });
});

function emptyRouteState(): RouteState {
  return <RouteState>{
    routesBegin: new strmap.StrMap({}),
    routesEnd: new strmap.StrMap({})
  };
}
