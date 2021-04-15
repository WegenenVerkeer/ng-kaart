import { HttpClient } from "@angular/common/http";
import { either } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { Observable } from "rxjs";
import * as rx from "rxjs";
import { catchError, map } from "rxjs/operators";

import { Interpreter, Validation } from "../../stijl/json-object-interpreting";
import * as st from "../../stijl/json-object-interpreting";
import * as ol from "../../util/openlayers-compat";
import { kaartLogger } from "../log";

import {
  LocatieServices2Service,
  TrajectNode,
} from "../locatieservices2/locatieservices2.service";
import { PuntLocatieReferentie } from "../locatieservices2/api-model";
import { GeometryRoute, ProtoRoute } from "./route.msg";

export interface WegNode {
  x: number;
  y: number;
}

export interface WegEdge {
  fromNode: WegNode;
  toNode: WegNode;
  geometry: ol.geom.Geometry;
}

const toWegNode: Interpreter<WegNode> = st.interpretRecord({
  x: st.field("x", st.num),
  y: st.field("y", st.num),
});

const geoJSONformat = new ol.format.GeoJSON();

const toGeometry: Interpreter<ol.geom.Geometry> = (json) => {
  try {
    return st.ok(
      geoJSONformat.readGeometry(json, {
        dataProjection: "EPSG:31370",
        featureProjection: "EPSG:31370",
      })
    );
  } catch (e) {
    return st.fail(
      "Kon GeoJson niet parsen: " + e + ". JSON:" + JSON.stringify(json)
    );
  }
};

const toWegEdge: Interpreter<WegEdge> = st.interpretRecord({
  fromNode: st.field("fromNode", toWegNode),
  toNode: st.field("toNode", toWegNode),
  geometry: st.field("geometry", toGeometry),
});

const toWegEdges: Interpreter<Array<WegEdge>> = st.arr(toWegEdge);

export interface RoutingService<Edge> {
  resolve(protoRoute: ProtoRoute): Observable<GeometryRoute<Edge>>;
}

const protoRouteToFallbackGeometryRoute: (
  protoRoute: ProtoRoute
) => GeometryRoute<any> = (protoRoute) => ({
  ...protoRoute,
  geometry: new ol.geom.LineString([
    protoRoute.begin.location,
    protoRoute.end.location,
  ]),
  edges: [],
});

const protoRouteToPuntLocatieReferenties: (
  protoRoute: ProtoRoute
) => PuntLocatieReferentie[] = (protoRoute) => [
  {
    geometry: {
      type: "Point",
      coordinates: protoRoute.begin.location,
    },
  },
  {
    geometry: {
      type: "Point",
      coordinates: protoRoute.end.location,
    },
  },
];

export class BasicLocatieServices2RoutingService
  implements RoutingService<any> {
  geoJSONformat = new ol.format.GeoJSON();
  locatieServices2Service: LocatieServices2Service;
  constructor(httpClient: HttpClient) {
    this.locatieServices2Service = new LocatieServices2Service(httpClient);
  }

  public resolve(protoRoute: ProtoRoute): Observable<GeometryRoute<any>> {
    return this.locatieServices2Service
      .zoekLijnlocatieviaPuntLocatieReferenties(
        protoRouteToPuntLocatieReferenties(protoRoute)
      )
      .pipe(
        map((lijnLocatie) => {
          return {
            id: protoRoute.id,
            version: protoRoute.version,
            begin: protoRoute.begin,
            end: protoRoute.end,
            geometry: geoJSONformat.readGeometry(lijnLocatie.geometry),
            edges: [],
          };
        })
      );
  }
}

export class ExtendedLocatieServices2RoutingService
  implements RoutingService<TrajectNode> {
  geoJSONformat = new ol.format.GeoJSON();
  locatieServices2Service: LocatieServices2Service;
  constructor(httpClient: HttpClient) {
    this.locatieServices2Service = new LocatieServices2Service(httpClient);
  }

  public resolve(
    protoRoute: ProtoRoute
  ): Observable<GeometryRoute<TrajectNode>> {
    return this.locatieServices2Service
      .zoekTrajectViaPuntLocatieReferenties(
        protoRouteToPuntLocatieReferenties(protoRoute)
      )
      .pipe(
        map(([traject, lijnLocatie]) => {
          return {
            id: protoRoute.id,
            version: protoRoute.version,
            begin: protoRoute.begin,
            end: protoRoute.end,
            geometry: geoJSONformat.readGeometry(lijnLocatie.geometry),
            edges: traject.nodes,
          };
        })
      );
  }
}

export class VerfijndeRoutingService implements RoutingService<WegEdge> {
  geoJSONformat = new ol.format.GeoJSON();
  constructor(private readonly http: HttpClient) {}

  public resolve(protoRoute: ProtoRoute): Observable<GeometryRoute<WegEdge>> {
    const url =
      `/routing/rest/routing` +
      `/from/${ol.coordinate.format(
        protoRoute.begin.location,
        "{x}/{y}",
        0
      )}/projected` +
      `/to/${ol.coordinate.format(
        protoRoute.end.location,
        "{x}/{y}",
        0
      )}/projected` +
      `?precision=50`;

    return this.http.get<object>(url).pipe(
      map((edges) => {
        const vldtn = toWegEdges(edges) as Validation<WegEdge[]>;
        const wegEdges: WegEdge[] = pipe(
          vldtn,
          either.getOrElse((errs) => {
            kaartLogger.error(
              `Onverwacht antwoordformaat van routeservice: ${errs}. We gaan verder zonder dit antwoord.`
            );
            throw errs;
          })
        );
        return {
          id: protoRoute.id,
          version: protoRoute.version,
          begin: protoRoute.begin,
          end: protoRoute.end,
          geometry: new ol.geom.GeometryCollection(
            wegEdges.map((edge) => edge.geometry)
          ),
          edges: wegEdges,
        };
      }),
      catchError((err) => {
        kaartLogger.error(`Routing heeft gefaald: ${err.message}`, err);
        return rx.of(protoRouteToFallbackGeometryRoute(protoRoute));
      })
    );
  }
}

export class SimpleRoutingService implements RoutingService<any> {
  public resolve(protoRoute: ProtoRoute): Observable<GeometryRoute<any>> {
    return rx.of({
      id: protoRoute.id,
      version: protoRoute.version,
      begin: protoRoute.begin,
      end: protoRoute.end,
      geometry: new ol.geom.LineString([
        protoRoute.begin.location,
        protoRoute.end.location,
      ]),
      edges: [],
    });
  }
}

export class NoopRoutingService implements RoutingService<any> {
  public resolve(_: ProtoRoute): Observable<GeometryRoute<any>> {
    return rx.EMPTY;
  }
}

export class CompositeRoutingService implements RoutingService<any> {
  constructor(private routingServices: RoutingService<any>[]) {}

  public resolve(protoRoute: ProtoRoute): Observable<GeometryRoute<any>> {
    return rx.merge(
      ...this.routingServices.map((rs) => rs.resolve(protoRoute))
    );
  }
}
