import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import * as ol from "projects/ng-kaart/src/lib/util/openlayers-compat";
import * as rx from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";

import { Point, PuntLocatieReferentie, Validation, Wegsegment, WegsegmentPuntLocatie } from "./locatieservices2-api-model";

export interface WegsegmentEnLocatie {
  readonly wegsegment: Wegsegment;
  readonly locatie: WegsegmentPuntLocatie;
}

@Injectable()
export class LocatieServices2Service {
  private url = "/locatieservices2";

  constructor(private readonly httpClient: HttpClient) {}

  private zoekPuntLocatieViaXY(x: number, y: number): rx.Observable<WegsegmentPuntLocatie> {
    return this.httpClient.get<WegsegmentPuntLocatie>(`${this.url}/rest/puntlocatie/via/xy?zoekafstand=10&x=${x}&y=${y}`);
  }

  private zoekPuntLocatiesViaXYOpWegsegment(x: number, y: number, oids: number[]): rx.Observable<WegsegmentPuntLocatie[]> {
    const point: Point = {
      type: "Point",
      crs: {
        properties: {
          name: "EPSG:31370"
        },
        type: "name"
      },
      bbox: [x, y, x, y],
      coordinates: [x, y]
    };
    const referenties: PuntLocatieReferentie[] = oids.map(oid => ({ wegsegmentId: oid, geometry: point }));

    return this.httpClient
      .post<Validation<WegsegmentPuntLocatie>[]>(`${this.url}/rest/puntlocatie/batch`, referenties)
      .pipe(map(vals => vals.filter(val => val.success).map(val => val.success!)));
  }

  private combineLocatiesMetWegsegmenten(locaties: WegsegmentPuntLocatie[], segmenten: Wegsegment[]): WegsegmentEnLocatie[] {
    const segmentenById = segmenten.reduce((map, segment) => {
      map[segment.wegsegmentId.oidn] = segment;
      return map;
    }, {});
    return locaties.map(locatie => ({ locatie: locatie, wegsegment: segmentenById[locatie.wegsegmentId.oidn] }));
  }

  private zoekWegsegment(oid: number): rx.Observable<Wegsegment> {
    return this.httpClient.get<Wegsegment>(`${this.url}/rest/wegsegment/${oid}`);
  }

  private zoekWegsegmentenViaXY(x: number, y: number, afstand = 100): rx.Observable<Wegsegment[]> {
    return this.httpClient.get<Wegsegment[]>(`${this.url}/rest/wegsegment?x=${x}&y=${y}&zoekafstand=${afstand}`);
  }

  zoekOpWegLocatie(coordinate: ol.Coordinate): rx.Observable<WegsegmentEnLocatie> {
    const x = coordinate[0];
    const y = coordinate[1];
    return this.zoekPuntLocatieViaXY(x, y).pipe(
      switchMap(weglocatie =>
        this.zoekWegsegment(weglocatie.wegsegmentId.oidn).pipe(map(wegSegment => ({ wegsegment: wegSegment, locatie: weglocatie })))
      ),
      catchError(error => {
        alert(error.statusText);
        return rx.throwError(error);
      })
    );
  }

  zoekOpWegen(coordinate: ol.Coordinate, afstand = 100): rx.Observable<WegsegmentEnLocatie[]> {
    const x = coordinate[0];
    const y = coordinate[1];
    return this.zoekWegsegmentenViaXY(x, y, afstand).pipe(
      switchMap(segmenten =>
        this.zoekPuntLocatiesViaXYOpWegsegment(x, y, segmenten.map(segment => segment.wegsegmentId.oidn)).pipe(
          map(locaties => this.combineLocatiesMetWegsegmenten(locaties, segmenten))
        )
      ),
      catchError(error => {
        alert(error.statusText);
        return rx.throwError(error);
      })
    );
  }
}
