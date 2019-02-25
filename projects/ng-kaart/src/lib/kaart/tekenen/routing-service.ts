import { HttpClient } from "@angular/common/http";
import * as ol from "openlayers";
import { Observable } from "rxjs";
import * as rx from "rxjs";
import { catchError, map } from "rxjs/operators";

import { Interpreter } from "../../stijl/json-object-interpreting";
import * as st from "../../stijl/json-object-interpreting";
import { matchGeometryType } from "../../util";
import { kaartLogger } from "../log";

import { GeometryRoute, ProtoRoute } from "./route.msg";

interface WegNode {
  x: number;
  y: number;
}

interface WegEdge {
  fromNode: WegNode;
  toNode: WegNode;
  geometry: ol.geom.Geometry;
}

const toWegNode: Interpreter<WegNode> = st.interpretRecord({
  x: st.field("x", st.num),
  y: st.field("y", st.num)
});

const geoJSONformat = new ol.format.GeoJSON();

const toGeometry: Interpreter<ol.geom.Geometry> = json => {
  try {
    return st.ok(geoJSONformat.readGeometry(json, { dataProjection: "EPSG:31370", featureProjection: "EPSG:31370" }));
  } catch (e) {
    return st.fail("Kon GeoJson niet parsen: " + e + ". JSON:" + JSON.stringify(json));
  }
};

const toWegEdge: Interpreter<WegEdge> = st.interpretRecord({
  fromNode: st.field("fromNode", toWegNode),
  toNode: st.field("toNode", toWegNode),
  geometry: st.field("geometry", toGeometry)
});

const toWegEdges: Interpreter<Array<WegEdge>> = st.arr(toWegEdge);

export interface RoutingService {
  resolve(protoRoute: ProtoRoute): Observable<GeometryRoute>;
}

export class VerfijndeRoutingService implements RoutingService {
  geoJSONformat = new ol.format.GeoJSON();
  constructor(private readonly http: HttpClient) {}

  public resolve(protoRoute: ProtoRoute): Observable<GeometryRoute> {
    const url =
      `/routing/rest/routing` +
      `/from/${ol.coordinate.format(protoRoute.begin.location, "{x}/{y}", 0)}/projected` +
      `/to/${ol.coordinate.format(protoRoute.end.location, "{x}/{y}", 0)}/projected` +
      `?precision=50`;

    return this.http.get<object>(url).pipe(
      map(toWegEdges),
      map(vldtn =>
        vldtn.getOrElseL(errs => {
          kaartLogger.error(`Onverwacht antwoordformaat van routeservice: ${errs}. We gaan verder zonder dit antwoord.`);
          return []; // TODO dit is niet goed -> we moeten de delete heroepen (of wachten met uitsturen)
        })
      ),
      catchError(err => {
        kaartLogger.error(`Routing heeft gefaald: ${err.message}`, err);
        return rx.of<WegEdge[]>([]); // TODO dit is niet goed -> we moeten de delete heroepen (of wachten met uitsturen)
      }),
      map(wegEdges => ({
        id: protoRoute.id,
        version: protoRoute.version,
        begin: protoRoute.begin,
        end: protoRoute.end,
        geometry: new ol.geom.GeometryCollection(wegEdges.map(edge => edge.geometry))
      }))
    );
  }
}

export class SimpleRoutingService implements RoutingService {
  public resolve(protoRoute: ProtoRoute): Observable<GeometryRoute> {
    return rx.of({
      id: protoRoute.id,
      version: protoRoute.version,
      begin: protoRoute.begin,
      end: protoRoute.end,
      geometry: new ol.geom.LineString([protoRoute.begin.location, protoRoute.end.location])
    });
  }
}

export class NoopRoutingService implements RoutingService {
  public resolve(_: ProtoRoute): Observable<GeometryRoute> {
    return rx.EMPTY;
  }
}

export class CompositeRoutingService implements RoutingService {
  constructor(private routingServices: RoutingService[]) {}

  public resolve(protoRoute: ProtoRoute): Observable<GeometryRoute> {
    return rx.merge(...this.routingServices.map(rs => rs.resolve(protoRoute)));
  }
}
