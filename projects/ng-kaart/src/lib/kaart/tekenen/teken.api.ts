import Feature from "ol/Feature";

export interface RoutingRapport {
  readonly waypoints: Feature[];
  readonly getekendeRoutes: GetekendeRoute[];
}

export function routingRapport(
  waypoints: Feature[],
  getekendeRoutes: GetekendeRoute[]
): RoutingRapport {
  return {
    waypoints: waypoints,
    getekendeRoutes: getekendeRoutes,
  };
}

export interface GetekendeRoute {
  readonly van: Feature;
  readonly tot: Feature;
  readonly segmenten: any[];
}

export function getekendeRoute(
  van: Feature,
  tot: Feature,
  segmenten: any[]
): GetekendeRoute {
  return {
    van: van,
    tot: tot,
    segmenten: segmenten,
  };
}
