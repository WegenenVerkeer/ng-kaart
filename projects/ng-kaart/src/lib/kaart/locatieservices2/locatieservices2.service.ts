import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import * as rx from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { pipe } from "fp-ts/lib/function";
import { option } from "fp-ts";
import * as ol from "../../util/openlayers-compat";

const format = new ol.format.GeoJSON();

import {
  Point,
  PuntLocatieReferentie,
  Validation,
  Wegsegment,
  WegsegmentPuntLocatie,
  LijnLocatie,
  Wegnummer,
  VerbindingsPuntLocatie,
  PuntLocatie,
  KantVanDeWeg,
} from "./api-model";

export interface WegsegmentEnLocatie {
  readonly wegsegment: Wegsegment;
  readonly locatie: WegsegmentPuntLocatie;
}

export interface GekliktPunt {
  readonly type: "GekliktPunt";
  readonly geometry: ol.geom.Point;
  readonly index: number;
}

export interface Straat {
  readonly type: "Straat";
  readonly geometry: ol.geom.MultiLineString;
  readonly rechterStraatnaam: option.Option<string>;
  readonly linkerStraatnaam: option.Option<string>;
  readonly index: number;
  readonly wegsegmentIds: number[];
  readonly wegnummer: option.Option<Wegnummer>;
}

export type TrajectNode = GekliktPunt | Straat;

export interface Traject {
  readonly geometry: ol.geom.MultiLineString;
  readonly nodes: TrajectNode[];
}

export function xyToPoint(x: number, y: number): Point {
  return {
    type: "Point",
    crs: {
      properties: {
        name: "EPSG:31370",
      },
      type: "name",
    },
    bbox: [x, y, x, y],
    coordinates: [x, y],
  };
}

@Injectable()
export class LocatieServices2Service {
  private url = "/locatieservices2";

  constructor(private readonly httpClient: HttpClient) {}

  bepaalKant(
    puntlocatie: PuntLocatie
  ): rx.Observable<option.Option<KantVanDeWeg>> {
    return this.httpClient
      .post<KantVanDeWeg>(
        `${this.url}/rest/kantvandeweg/via/puntlocatie`,
        puntlocatie
      )
      .pipe(map(option.some));
  }

  private zoekPuntLocatiesViaReferenties(
    referenties: PuntLocatieReferentie[]
  ): rx.Observable<WegsegmentPuntLocatie[]> {
    return this.httpClient
      .post<Validation<WegsegmentPuntLocatie>[]>(
        `${this.url}/rest/puntlocatie/batch`,
        referenties
      )
      .pipe(
        map((vals) =>
          vals.filter((val) => val.success).map((val) => val.success!)
        )
      );
  }

  private zoekWegsegmenten(oids: number[]): rx.Observable<Wegsegment[]> {
    return this.httpClient
      .post<Validation<Wegsegment>[]>(`${this.url}/rest/wegsegment/batch`, oids)
      .pipe(
        map((vals) =>
          vals.filter((val) => val.success).map((val) => val.success!)
        )
      );
  }

  private maakStraatNode(
    verbindingsPunt: VerbindingsPuntLocatie | WegsegmentPuntLocatie,
    index: number,
    wegsegmenten: Wegsegment[],
    lijnLocatie: LijnLocatie,
    puntlocaties: WegsegmentPuntLocatie[]
  ) {
    const wegSegmentId = verbindingsPunt.wegsegmentId.oidn;
    const maybeWegSegment = option.fromNullable(
      wegsegmenten.find((segment) => segment.wegsegmentId.oidn === wegSegmentId)
    );
    const maybePuntLocatie = pipe(
      option.fromNullable(
        puntlocaties.find(
          (locatie) =>
            locatie.wegsegmentId.oidn === wegSegmentId &&
            locatie.relatief !== undefined
        )
      ),
      option.chain((locatie) => option.fromNullable(locatie.relatief))
    );

    const geom = new ol.geom.MultiLineString([
      lijnLocatie.geometry.coordinates[index],
    ]);

    return {
      type: "Straat",
      geometry: geom,
      index,
      wegsegmentIds: [wegSegmentId],
      linkerStraatnaam: pipe(
        maybeWegSegment,
        option.map((wegsegment) => wegsegment.linkerStraatnaam)
      ),
      rechterStraatnaam: pipe(
        maybeWegSegment,
        option.map((wegsegment) => wegsegment.rechterStraatnaam)
      ),
      wegnummer: pipe(
        maybePuntLocatie,
        option.map((relatief) => relatief.wegnummer)
      ),
    } as Straat;
  }

  private maakGekliktPunt(index: number, punt: PuntLocatie) {
    return {
      type: "GekliktPunt",
      index,
      geometry: format.readGeometry(punt.geometry),
    } as GekliktPunt;
  }

  private lijnLocatieEnSegmentenNaarTraject(
    wegsegmenten: Wegsegment[],
    lijnLocatie: LijnLocatie,
    puntlocaties: WegsegmentPuntLocatie[]
  ): Traject {
    const nodes = lijnLocatie.punten.map((punt, index) => {
      switch (punt.type) {
        case "WegsegmentPuntLocatie":
          if (
            index > 0 &&
            lijnLocatie.punten[index - 1].type === "WegsegmentPuntLocatie"
          ) {
            // We hebben 2 opeenvolgende wegsegmentpunten, we gaan een straat ertussen simuleren.
            return [
              this.maakStraatNode(
                <WegsegmentPuntLocatie>punt,
                index - 1,
                wegsegmenten,
                lijnLocatie,
                puntlocaties
              ),
              this.maakGekliktPunt(index, punt),
            ];
          } else if (index === 0) {
            return [
              this.maakGekliktPunt(index, punt),
              this.maakStraatNode(
                <WegsegmentPuntLocatie>punt,
                index,
                wegsegmenten,
                lijnLocatie,
                puntlocaties
              ),
            ];
          } else {
            return [this.maakGekliktPunt(index, punt)];
          }
        case "VerbindingsPuntLocatie":
          return [
            this.maakStraatNode(
              <VerbindingsPuntLocatie>punt,
              index,
              wegsegmenten,
              lijnLocatie,
              puntlocaties
            ),
          ];
      }
    });
    return {
      geometry: format.readGeometry(
        lijnLocatie.geometry
      ) as ol.geom.MultiLineString,
      nodes: [].concat.apply([], nodes),
    };
  }

  zoekLijnlocatieviaPuntLocatieReferenties(
    punten: PuntLocatieReferentie[]
  ): rx.Observable<LijnLocatie> {
    return this.httpClient.post<LijnLocatie>(
      `${this.url}/rest/lijnlocatie`,
      punten
    );
  }

  zoekTrajectViaPunten(
    punten: ol.Coordinate[]
  ): rx.Observable<[Traject, LijnLocatie]> {
    return this.zoekTrajectViaPuntLocatieReferenties(
      punten.map((punt) => ({ geometry: xyToPoint(punt[0], punt[1]) }))
    );
  }

  zoekTrajectViaPuntLocatieReferenties(
    punten: PuntLocatieReferentie[]
  ): rx.Observable<[Traject, LijnLocatie]> {
    return this.zoekLijnlocatieviaPuntLocatieReferenties(punten).pipe(
      switchMap((lijnLocatie) => {
        const verbindingsPuntLocaties = lijnLocatie.punten
          .filter(
            (punt) =>
              punt.type === "VerbindingsPuntLocatie" ||
              punt.type === "WegsegmentPuntLocatie"
          )
          .map((punt) => <VerbindingsPuntLocatie | WegsegmentPuntLocatie>punt);
        return rx
          .combineLatest(
            this.zoekWegsegmenten(
              verbindingsPuntLocaties.map((punt) => punt.wegsegmentId.oidn)
            ),
            this.zoekPuntLocatiesViaReferenties(
              verbindingsPuntLocaties.map((punt) => ({
                wegsegmentId: punt.wegsegmentId.oidn,
                geometry: punt.geometry,
              }))
            )
          )
          .pipe(
            map(([wegsegmenten, puntlocaties]) => ({
              wegsegmenten,
              lijnLocatie,
              puntlocaties,
            }))
          );
      }),
      map((data) => {
        const res: [Traject, LijnLocatie] = [
          this.lijnLocatieEnSegmentenNaarTraject(
            data.wegsegmenten,
            data.lijnLocatie,
            data.puntlocaties
          ),
          data.lijnLocatie,
        ];
        return res;
      })
    );
  }
}
