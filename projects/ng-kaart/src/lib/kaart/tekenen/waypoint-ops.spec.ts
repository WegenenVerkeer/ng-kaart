import * as array from "fp-ts/lib/Array";
import { none, some } from "fp-ts/lib/Option";

import { addWaypoint, removeWaypoint } from "./waypoint-ops";
import { AddWaypoint, RemoveWaypoint, Waypoint } from "./waypoint.msg";

describe("Route Changes bij sequentieel toevoegen:", () => {
  describe("Wanneer een eerste waypoint toegevoegd wordt", () => {
    it("moeten er geen nieuwe routes zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));

      expect(transition1.routeChanges.routesRemoved.length).toBe(0);
      expect(transition1.routeChanges.routesAdded.length).toBe(0);

      expect(transition1.routeState.length).toBe(1);
      expect(transition1.routeState[0]).toBe(waypoint0);
    });
  });

  describe("Wanneer er 2 dezelfde waypoints toegevoegd worden", () => {
    it("moeten er geen nieuwe routes zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const overschrevenWaypoint = Waypoint(0, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(none, overschrevenWaypoint));

      expect(transition2.routeChanges.routesRemoved.length).toBe(0);
      expect(transition2.routeChanges.routesAdded.length).toBe(0);

      expect(transition2.routeState.length).toBe(1);
      expect(transition2.routeState[0]).toBe(overschrevenWaypoint);
    });
  });

  describe("Wanneer er 2 verschillende waypoints toegevoegd worden, die niet naar elkaar verwijzen", () => {
    it("moeten er geen nieuwe routes zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(none, waypoint1));

      expect(transition2.routeChanges.routesRemoved.length).toBe(0);
      expect(transition2.routeChanges.routesAdded.length).toBe(0);

      expect(transition2.routeState.length).toBe(1);
      expect(transition2.routeState[0]).toBe(waypoint1);
    });
  });

  describe("Wanneer er 2 verschillende waypoints toegevoegd worden", () => {
    it("moeten er een nieuwe route zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(some(waypoint0), waypoint1));

      expect(transition2.routeChanges.routesRemoved.length).toBe(0);
      expect(transition2.routeChanges.routesAdded.length).toBe(1);
      const routeAdded = transition2.routeChanges.routesAdded[0];
      expect(routeAdded.begin).toBe(waypoint0);
      expect(routeAdded.end).toBe(waypoint1);

      expect(transition2.routeState.length).toBe(2);
      expect(transition2.routeState[0]).toBe(waypoint0);
      expect(transition2.routeState[1]).toBe(waypoint1);
    });
  });

  describe("Wanneer er 3 verschillende waypoints toegevoegd worden", () => {
    it("moeten er een 2 nieuwe routes zijn", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(some(waypoint0), waypoint1));
      const waypoint2 = Waypoint(2, [2, 2]);
      const transition3 = addWaypoint(transition2.routeState, AddWaypoint(some(waypoint1), waypoint2));

      expect(transition3.routeChanges.routesRemoved.length).toBe(0);
      expect(transition3.routeChanges.routesAdded.length).toBe(1);
      const routeAdded = transition3.routeChanges.routesAdded[0];
      expect(routeAdded.begin).toBe(waypoint1);
      expect(routeAdded.end).toBe(waypoint2);

      expect(transition3.routeState.length).toBe(3);
      expect(transition3.routeState[0]).toBe(waypoint0);
      expect(transition3.routeState[1]).toBe(waypoint1);
      expect(transition3.routeState[2]).toBe(waypoint2);
    });
  });
});

describe("Route Changes bij verwijderen:", () => {
  describe("Wanneer het enige waypoint verwijderd wordt", () => {
    it("moeten op een lege beginsituatie komen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const transition2 = removeWaypoint(transition1.routeState, RemoveWaypoint(waypoint0));

      expect(transition2.routeChanges.routesAdded.length).toBe(0);
      expect(transition2.routeChanges.routesRemoved.length).toBe(0);

      expect(transition2.routeState.length).toBe(0);
    });
  });
  describe("Wanneer het begin waypoint verwijderd wordt", () => {
    it("moet de route verdwijnen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(some(waypoint0), waypoint1));
      const transition3 = removeWaypoint(transition2.routeState, RemoveWaypoint(waypoint0));

      expect(transition3.routeChanges.routesAdded.length).toBe(0);
      expect(transition3.routeChanges.routesRemoved.length).toBe(1);
      expect(transition3.routeChanges.routesRemoved[0].begin).toBe(waypoint0);
      expect(transition3.routeChanges.routesRemoved[0].end).toBe(waypoint1);

      expect(transition3.routeState.length).toBe(1);
      expect(transition3.routeState[0]).toBe(waypoint1);
    });
  });
  describe("Wanneer het einde waypoint verwijderd wordt", () => {
    it("moet de route verdwijnen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(some(waypoint0), waypoint1));
      const transition3 = removeWaypoint(transition2.routeState, RemoveWaypoint(waypoint1));

      expect(transition3.routeChanges.routesAdded.length).toBe(0);
      expect(transition3.routeChanges.routesRemoved.length).toBe(1);
      expect(transition3.routeChanges.routesRemoved[0].begin).toBe(waypoint0);
      expect(transition3.routeChanges.routesRemoved[0].end).toBe(waypoint1);

      expect(transition3.routeState.length).toBe(1);
      expect(transition3.routeState[0]).toBe(waypoint0);
    });
  });
  describe("Wanneer een midden waypoint verwijderd wordt", () => {
    it("moet er 2 routes verdwijnen en 1 in de plaats komen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(some(waypoint0), waypoint1));
      const waypoint2 = Waypoint(2, [2, 2]);
      const transition3 = addWaypoint(transition2.routeState, AddWaypoint(some(waypoint1), waypoint2));
      const transition4 = removeWaypoint(transition3.routeState, RemoveWaypoint(waypoint1));

      expect(transition4.routeChanges.routesAdded.length).toBe(1);
      const routeAdded = transition4.routeChanges.routesAdded[0];
      expect(routeAdded.begin).toBe(waypoint0);
      expect(routeAdded.end).toBe(waypoint2);
      expect(transition4.routeChanges.routesRemoved.length).toBe(2);
      const removed1 = array.findFirst(transition4.routeChanges.routesRemoved, pr => pr.begin === waypoint0).toNullable();
      expect(removed1.end).toBe(waypoint1);
      const removed2 = array.findFirst(transition4.routeChanges.routesRemoved, pr => pr.end === waypoint2).toNullable();
      expect(removed2.begin).toBe(waypoint1);

      expect(transition4.routeState.length).toBe(2);
      expect(transition4.routeState[0]).toBe(waypoint0);
      expect(transition4.routeState[1]).toBe(waypoint2);
    });
  });
});

describe("Route Changes bij toevoegen in het midden:", () => {
  describe("Wanneer er een waypoint in het midden toegevoegd wordt", () => {
    it("moeten er een 2 nieuwe routes zijn, en 1 route moet verdwijnen", () => {
      const waypoint0 = Waypoint(0, [0, 0]);
      const transition1 = addWaypoint([], AddWaypoint(none, waypoint0));
      const waypoint1 = Waypoint(1, [1, 1]);
      const transition2 = addWaypoint(transition1.routeState, AddWaypoint(some(waypoint0), waypoint1));
      const waypoint2 = Waypoint(2, [2, 2]);
      const transition3 = addWaypoint(transition2.routeState, AddWaypoint(some(waypoint0), waypoint2));

      expect(transition3.routeChanges.routesRemoved.length).toBe(1);
      const routeRemoved = transition3.routeChanges.routesRemoved[0];
      expect(routeRemoved.begin).toBe(waypoint0);
      expect(routeRemoved.end).toBe(waypoint1);
      expect(transition3.routeChanges.routesAdded.length).toBe(2);
      const added1 = array.findFirst(transition3.routeChanges.routesAdded, pr => pr.end === waypoint2).toNullable();
      expect(added1.begin).toBe(waypoint0);
      const added2 = array.findFirst(transition3.routeChanges.routesAdded, pr => pr.begin === waypoint2).toNullable();
      expect(added2.end).toBe(waypoint1);

      expect(transition3.routeState.length).toBe(3);
      expect(transition3.routeState[0]).toBe(waypoint0);
      expect(transition3.routeState[1]).toBe(waypoint2);
      expect(transition3.routeState[2]).toBe(waypoint1);
    });
  });
});
