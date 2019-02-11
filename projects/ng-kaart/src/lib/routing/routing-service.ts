import { Http } from "@angular/http";
import * as ol from "openlayers";
import { Observable } from "rxjs";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import { Interpreter } from "../stijl/json-object-interpreting";
import * as st from "../stijl/json-object-interpreting";

import { Waypoint } from "./waypoint-msg";

export interface ProtoRoute {
  id: string;
  begin: Waypoint;
  end: Waypoint;
}

export interface VerfijndeRoute {
  id: string;
  begin: Waypoint;
  end: Waypoint;
  geometry: ol.geom.Geometry;
}

interface WegNode {
  x: number;
  y: number;
}

interface WegEdge {
  fromNode: WegNode;
  toNode: WegNode;
  geometry: string;
}

const toWegNode: Interpreter<WegNode> = st.interpretRecord({
  x: st.field("x", st.num),
  y: st.field("y", st.num)
});

const toWegEdge: Interpreter<WegEdge> = st.interpretRecord({
  fromNode: st.field("fromNode", toWegNode),
  toNode: st.field("toNode", toWegNode),
  geometry: st.field("geometry", st.str)
});

const toWegEdges: Interpreter<Array<WegEdge>> = st.arr(toWegEdge);

export interface RoutingService {
  resolve(protoRoute: ProtoRoute): Observable<VerfijndeRoute>;
}

export class VerfijndeRoutingService implements RoutingService {
  geoJSONformat = new ol.format.GeoJSON();
  constructor(private http: Http) {}

  private geometryVanWegedges(wegEdges: WegEdge[]) {
    return new ol.geom.GeometryCollection(wegEdges.map((wegEdge: WegEdge) => this.geoJSONformat.readGeometry(wegEdge.geometry)));
  }

  public resolve(protoRoute: ProtoRoute): Observable<VerfijndeRoute> {
    const url =
      `/routing/rest/routing` +
      `/from/${ol.coordinate.format(protoRoute.begin.coordinate, "{x}/{y}", 0)}/projected` +
      `/to/${ol.coordinate.format(protoRoute.end.coordinate, "{x}/{y}", 0)}/projected` +
      `?precision=50`;

    return this.http.get(url).pipe(
      map(res => res.json()),
      map(toWegEdges),
      map(vldtn =>
        vldtn.getOrElseL(errs => {
          throw new Error(`slecht formaat ${errs}`);
        })
      ),
      map(wegEdges => this.geometryVanWegedges(wegEdges)),
      map(
        geometry =>
          <VerfijndeRoute>{
            id: protoRoute.id,
            begin: protoRoute.begin,
            end: protoRoute.end,
            geometry: geometry
          }
      )
    );
  }
}

export class SimpleRoutingService implements RoutingService {
  public resolve(protoRoute: ProtoRoute): Observable<VerfijndeRoute> {
    return rx.of(<VerfijndeRoute>{
      id: protoRoute.id,
      begin: protoRoute.begin,
      end: protoRoute.end,
      geometry: new ol.geom.LineString([protoRoute.begin.coordinate, protoRoute.end.coordinate])
    });
  }
}

export class NoopRoutingService implements RoutingService {
  public resolve(_: ProtoRoute): Observable<VerfijndeRoute> {
    return rx.empty();
  }
}

export class CompositeRoutingService implements RoutingService {
  constructor(private routingServices: RoutingService[]) {}

  public resolve(protoRoute: ProtoRoute): Observable<VerfijndeRoute> {
    return rx.concat(...this.routingServices.map(rs => rs.resolve(protoRoute)));
  }
}
