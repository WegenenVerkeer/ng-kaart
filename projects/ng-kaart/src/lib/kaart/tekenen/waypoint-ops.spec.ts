import { array, option, tuple } from "fp-ts";
import { pipe } from "fp-ts/lib/function";

import { addWaypoint, emptyRouteState, removeWaypoint } from "./waypoint-ops";
import { AddWaypoint, RemoveWaypoint, Waypoint } from "./waypoint.msg";

describe("Route Changes bij sequentieel toevoegen:", () => {
  describe("Wanneer een eerste waypoint toegevoegd wordt", () => {
    it("moeten er geen nieuwe routes zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );

      expect(tuple.snd(transition1).routesRemoved.length).toBe(0);
      expect(tuple.snd(transition1).routesAdded.length).toBe(0);

      expect(tuple.fst(transition1).waypoints.length).toBe(1);
      expect(tuple.fst(transition1).waypoints[0]).toBe(waypoint0);
    });
  });

  describe("Wanneer er 2 verschillende waypoints toegevoegd worden, die niet naar elkaar verwijzen", () => {
    it("moeten er geen een  routes zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(
        tuple.fst(transition1),
        AddWaypoint(option.none, waypoint1)
      );

      expect(tuple.snd(transition2).routesRemoved.length).toBe(0);
      expect(tuple.snd(transition2).routesAdded.length).toBe(1);
      const routeAdded = tuple.snd(transition2).routesAdded[0];
      expect(routeAdded.begin).toBe(waypoint1);
      expect(routeAdded.end).toBe(waypoint0);

      expect(tuple.fst(transition2).waypoints.length).toBe(2);
      expect(tuple.fst(transition2).waypoints[0]).toBe(waypoint1);
    });
  });

  describe("Wanneer er 2 verschillende waypoints toegevoegd worden", () => {
    it("moeten er een nieuwe route zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(
        tuple.fst(transition1),
        AddWaypoint(option.some(waypoint0), waypoint1)
      );

      expect(tuple.snd(transition2).routesRemoved.length).toBe(0);
      expect(tuple.snd(transition2).routesAdded.length).toBe(1);
      const routeAdded = tuple.snd(transition2).routesAdded[0];
      expect(routeAdded.begin).toBe(waypoint0);
      expect(routeAdded.end).toBe(waypoint1);

      expect(tuple.fst(transition2).waypoints.length).toBe(2);
      expect(tuple.fst(transition2).waypoints[0]).toBe(waypoint0);
      expect(tuple.fst(transition2).waypoints[1]).toBe(waypoint1);
    });
  });

  describe("Wanneer er 3 verschillende waypoints toegevoegd worden", () => {
    it("moeten er een 2 nieuwe routes zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(
        tuple.fst(transition1),
        AddWaypoint(option.some(waypoint0), waypoint1)
      );
      const waypoint2 = Waypoint(2, [2, 2]);
      const transition3 = addWaypoint(
        tuple.fst(transition2),
        AddWaypoint(option.some(waypoint1), waypoint2)
      );

      expect(tuple.snd(transition3).routesRemoved.length).toBe(0);
      expect(tuple.snd(transition3).routesAdded.length).toBe(1);
      const routeAdded = tuple.snd(transition3).routesAdded[0];
      expect(routeAdded.begin).toBe(waypoint1);
      expect(routeAdded.end).toBe(waypoint2);

      expect(tuple.fst(transition3).waypoints.length).toBe(3);
      expect(tuple.fst(transition3).waypoints[0]).toBe(waypoint0);
      expect(tuple.fst(transition3).waypoints[1]).toBe(waypoint1);
      expect(tuple.fst(transition3).waypoints[2]).toBe(waypoint2);
    });
  });
});

describe("Route Changes bij verwijderen:", () => {
  describe("Wanneer het enige waypoint verwijderd wordt", () => {
    it("moeten op een lege beginsituatie komen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const transition2 = removeWaypoint(
        tuple.fst(transition1),
        RemoveWaypoint(waypoint0)
      );

      expect(tuple.snd(transition2).routesAdded.length).toBe(0);
      expect(tuple.snd(transition2).routesRemoved.length).toBe(0);

      expect(tuple.fst(transition2).waypoints.length).toBe(0);
    });
  });
  describe("Wanneer het begin waypoint verwijderd wordt", () => {
    it("moet de route verdwijnen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(
        tuple.fst(transition1),
        AddWaypoint(option.some(waypoint0), waypoint1)
      );
      const transition3 = removeWaypoint(
        tuple.fst(transition2),
        RemoveWaypoint(waypoint0)
      );

      expect(tuple.snd(transition3).routesAdded.length).toBe(0);
      expect(tuple.snd(transition3).routesRemoved.length).toBe(1);
      expect(tuple.snd(transition3).routesRemoved[0].begin).toBe(waypoint0);
      expect(tuple.snd(transition3).routesRemoved[0].end).toBe(waypoint1);

      expect(tuple.fst(transition3).waypoints.length).toBe(1);
      expect(tuple.fst(transition3).waypoints[0]).toBe(waypoint1);
    });
  });
  describe("Wanneer het einde waypoint verwijderd wordt", () => {
    it("moet de route verdwijnen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(
        tuple.fst(transition1),
        AddWaypoint(option.some(waypoint0), waypoint1)
      );
      const transition3 = removeWaypoint(
        tuple.fst(transition2),
        RemoveWaypoint(waypoint1)
      );

      expect(tuple.snd(transition3).routesAdded.length).toBe(0);
      expect(tuple.snd(transition3).routesRemoved.length).toBe(1);
      expect(tuple.snd(transition3).routesRemoved[0].begin).toBe(waypoint0);
      expect(tuple.snd(transition3).routesRemoved[0].end).toBe(waypoint1);

      expect(tuple.fst(transition3).waypoints.length).toBe(1);
      expect(tuple.fst(transition3).waypoints[0]).toBe(waypoint0);
    });
  });
  describe("Wanneer een midden waypoint verwijderd wordt", () => {
    it("moet er 2 routes verdwijnen en 1 in de plaats komen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(
        tuple.fst(transition1),
        AddWaypoint(option.some(waypoint0), waypoint1)
      );
      const waypoint2 = Waypoint(2, [2, 2]);
      const transition3 = addWaypoint(
        tuple.fst(transition2),
        AddWaypoint(option.some(waypoint1), waypoint2)
      );
      const transition4 = removeWaypoint(
        tuple.fst(transition3),
        RemoveWaypoint(waypoint1)
      );

      expect(tuple.snd(transition4).routesAdded.length).toBe(1);
      const routeAdded = tuple.snd(transition4).routesAdded[0];
      expect(routeAdded.begin).toBe(waypoint0);
      expect(routeAdded.end).toBe(waypoint2);
      expect(tuple.snd(transition4).routesRemoved.length).toBe(2);
      const removed1 = pipe(
        tuple.snd(transition4).routesRemoved,
        array.findFirst((pr) => pr.begin === waypoint0),
        option.toNullable
      );
      expect(removed1.end).toBe(waypoint1);
      const removed2 = pipe(
        tuple.snd(transition4).routesRemoved,
        array.findFirst((pr) => pr.end === waypoint2),
        option.toNullable
      );
      expect(removed2.begin).toBe(waypoint1);

      expect(tuple.fst(transition4).waypoints.length).toBe(2);
      expect(tuple.fst(transition4).waypoints[0]).toBe(waypoint0);
      expect(tuple.fst(transition4).waypoints[1]).toBe(waypoint2);
    });
  });
});

describe("Route Changes bij toevoegen in het midden:", () => {
  describe("Wanneer er een waypoint in het midden toegevoegd wordt", () => {
    it("moeten er een 2 nieuwe routes zijn, en 1 route moet verdwijnen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint(
        emptyRouteState,
        AddWaypoint(option.none, waypoint0)
      );
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(
        tuple.fst(transition1),
        AddWaypoint(option.some(waypoint0), waypoint1)
      );
      const waypoint2 = Waypoint(2, [2, 2]);
      const transition3 = addWaypoint(
        tuple.fst(transition2),
        AddWaypoint(option.some(waypoint0), waypoint2)
      );

      expect(tuple.snd(transition3).routesRemoved.length).toBe(1);
      const routeRemoved = tuple.snd(transition3).routesRemoved[0];
      expect(routeRemoved.begin).toBe(waypoint0);
      expect(routeRemoved.end).toBe(waypoint1);
      expect(tuple.snd(transition3).routesAdded.length).toBe(2);
      const added1 = pipe(
        tuple.snd(transition3).routesAdded,
        array.findFirst((pr) => pr.end === waypoint2),
        option.toNullable
      );
      expect(added1.begin).toBe(waypoint0);
      const added2 = pipe(
        tuple.snd(transition3).routesAdded,
        array.findFirst((pr) => pr.begin === waypoint2),
        option.toNullable
      );
      expect(added2.end).toBe(waypoint1);

      expect(tuple.fst(transition3).waypoints.length).toBe(3);
      expect(tuple.fst(transition3).waypoints[0]).toBe(waypoint0);
      expect(tuple.fst(transition3).waypoints[1]).toBe(waypoint2);
      expect(tuple.fst(transition3).waypoints[2]).toBe(waypoint1);
    });
  });
});
