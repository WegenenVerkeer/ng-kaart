import { HttpClient, HttpParams } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { Map } from "immutable";
import * as ol from "openlayers";
import { OperatorFunction } from "rxjs/interfaces";
import { Observable } from "rxjs/Observable";
import { from } from "rxjs/observable/from";
import { map, mergeAll, mergeMap, reduce, shareReplay } from "rxjs/operators";

import { AbstractZoeker, geoJSONOptions, ZoekResultaat, ZoekResultaten } from "./abstract-zoeker";
import { CrabZoekerConfig } from "./crab-zoeker.config";
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE } from "./zoeker-representatie.service";
import { ZOEKER_CFG, ZoekerConfigData } from "./zoeker.config";

export interface LambertLocation {
  readonly X_Lambert72: number;
  readonly Y_Lambert72: number;
}

export interface LocatorServiceResult {
  readonly FormattedAddress: string;
  readonly Location: LambertLocation;
  readonly LocationType: string;
}

export interface LocatorServiceResults {
  readonly LocationResult: LocatorServiceResult[];
}

export interface SuggestionServiceResults {
  readonly SuggestionResult: string[];
}

export interface CrabZoekInput {
  readonly type: "CrabGemeente" | "CrabStraat" | "CrabHuisnummer";
}

export interface CrabGemeente extends CrabZoekInput {
  readonly type: "CrabGemeente";
  readonly postcodes: string;
  readonly niscode: number;
  readonly naam: string;
  readonly id: number;
}

export interface CrabStraat extends CrabZoekInput {
  readonly type: "CrabStraat";
  readonly naam: string;
  readonly gemeente: CrabGemeente;
  readonly id: number;
}

export interface CrabHuisnummer extends CrabZoekInput {
  readonly type: "CrabHuisnummer";
  readonly huisnummer: string;
  readonly niscode: number;
  readonly straat: CrabStraat;
  readonly id: number;
}

export interface CrabBBox {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumY: number;
  readonly maximumY: number;
}

export interface CrabPositie {
  readonly x: number;
  readonly y: number;
}

export class CrabZoekResultaat implements ZoekResultaat {
  readonly partialMatch = false;
  readonly index: number;
  readonly omschrijving: string;
  readonly bron: string;
  readonly zoeker: string;
  readonly geometry: ol.geom.Geometry;
  readonly icoon: string;
  readonly style: ol.style.Style;
  readonly extent: ol.Extent;

  constructor(
    x: number,
    y: number,
    omschrijving: string,
    bron: string,
    index: number,
    zoeker: string,
    icoon: string,
    style: ol.style.Style,
    extent?: ol.Extent
  ) {
    this.index = index + 1;
    this.geometry = new ol.geom.Point([x, y]);
    this.extent = extent ? extent : this.geometry.getExtent();
    this.omschrijving = omschrijving;
    this.bron = bron;
    this.zoeker = zoeker;
    this.icoon = icoon;
    this.style = style;
  }
}

@Injectable()
export class CrabZoekerService implements AbstractZoeker {
  private readonly crabZoekerConfig: CrabZoekerConfig;
  private legende: Map<string, string>;

  constructor(
    private readonly http: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.crab);
    this.legende = Map.of(this.naam(), this.zoekerRepresentatie.getSvgNaam("Crab"));
  }

  naam(): string {
    return "CRAB";
  }

  private voegCrabResultatenToe(result: ZoekResultaten, crabResultaten: LocatorServiceResults): ZoekResultaten {
    const startIndex = result.resultaten.length;
    result.resultaten = result.resultaten.concat(
      crabResultaten.LocationResult
        // Waarschijnlijk gaan we de crab gemeenten niet laten zien,
        //  we hebben daar toch alleen het middelpunt van. Google geeft een beter resultaat.
        //  Maar voorlopig zitten ze er nog in, de gebruikers moeten beslissen.
        // .filter(crabResultaat => crabResultaat.LocationType !== "crab_gemeente")
        .map(
          (crabResultaat, index) =>
            new CrabZoekResultaat(
              crabResultaat.Location.X_Lambert72,
              crabResultaat.Location.Y_Lambert72,
              crabResultaat.FormattedAddress,
              crabResultaat.LocationType,
              startIndex + index,
              this.naam(),
              this.zoekerRepresentatie.getSvgNaam("Crab"),
              this.zoekerRepresentatie.getOlStyle("Crab")
            )
        )
    );
    return result;
  }

  getAlleGemeenten$(): Observable<CrabGemeente[]> {
    return this.http
      .get<CrabGemeente[]>(this.crabZoekerConfig.url + "/rest/crab/gemeenten")
      .pipe(map(gemeentes => gemeentes.map(gemeente => ({ ...gemeente, type: "CrabGemeente" as "CrabGemeente" }))), shareReplay(1));
  }

  private bboxNaarZoekResultaat(naam: string, bron: string, bbox: CrabBBox): CrabZoekResultaat {
    const extent: ol.Extent = [bbox.minimumX, bbox.minimumY, bbox.maximumX, bbox.maximumY];
    const middlePoint = ol.extent.getCenter(extent);
    return new CrabZoekResultaat(
      middlePoint[0],
      middlePoint[1],
      naam,
      bron,
      0,
      this.naam(),
      this.zoekerRepresentatie.getSvgNaam("Crab"),
      this.zoekerRepresentatie.getOlStyle("Crab"),
      extent
    );
  }

  private positieNaarZoekResultaat(naam: string, bron: string, pos: CrabPositie): CrabZoekResultaat {
    return new CrabZoekResultaat(
      pos.x,
      pos.y,
      naam,
      bron,
      0,
      this.naam(),
      this.zoekerRepresentatie.getSvgNaam("Crab"),
      this.zoekerRepresentatie.getOlStyle("Crab")
    );
  }

  private getGemeenteBBox$(gemeente: CrabGemeente): Observable<ZoekResultaten> {
    return this.http
      .get<CrabBBox>(this.crabZoekerConfig.url + "/rest/crab/gemeente/" + gemeente.niscode)
      .pipe(
        map(bbox => new ZoekResultaten(this.naam(), [], [this.bboxNaarZoekResultaat(gemeente.naam, "CrabGemeente", bbox)], this.legende)),
        shareReplay(1)
      );
  }

  getStraten$(gemeente: CrabGemeente): Observable<CrabStraat[]> {
    return this.http
      .get<CrabStraat[]>(this.crabZoekerConfig.url + "/rest/crab/straten/" + gemeente.niscode)
      .pipe(map(straten => straten.map(straat => ({ ...straat, gemeente: gemeente, type: "CrabStraat" as "CrabStraat" }))), shareReplay(1));
  }

  private getStraatBBox$(straat: CrabStraat): Observable<ZoekResultaten> {
    return this.http
      .get<CrabBBox>(this.crabZoekerConfig.url + "/rest/crab/straat/" + straat.id)
      .pipe(
        map(
          bbox =>
            new ZoekResultaten(
              this.naam(),
              [],
              [this.bboxNaarZoekResultaat(`${straat.naam}, ${straat.gemeente.naam}`, "CrabStraat", bbox)],
              this.legende
            )
        ),
        shareReplay(1)
      );
  }

  getHuisnummers$(straat: CrabStraat): Observable<CrabHuisnummer[]> {
    return this.http
      .get<CrabHuisnummer[]>(this.crabZoekerConfig.url + "/rest/crab/huisnummers/" + straat.id)
      .pipe(
        map(huisnummers => huisnummers.map(huisnummer => ({ ...huisnummer, straat: straat, type: "CrabHuisnummer" as "CrabHuisnummer" }))),
        shareReplay(1)
      );
  }

  private getHuisnummerPositie$(huisnummer: CrabHuisnummer): Observable<ZoekResultaten> {
    return this.http
      .get<CrabPositie>(this.crabZoekerConfig.url + "/rest/crab/huisnummer/" + huisnummer.straat.id + "/" + huisnummer.huisnummer)
      .pipe(
        map(
          positie =>
            new ZoekResultaten(
              this.naam(),
              [],
              [
                this.positieNaarZoekResultaat(
                  `${huisnummer.straat.naam} ${huisnummer.huisnummer}, ${huisnummer.straat.gemeente.naam}`,
                  "CrabHuis",
                  positie
                )
              ],
              this.legende
            )
        ),
        shareReplay(1)
      );
  }

  zoek$(zoekterm: string | CrabZoekInput): Observable<ZoekResultaten> {
    function options(waarde) {
      return {
        params: new HttpParams().set("query", waarde)
      };
    }

    if (typeof zoekterm === "string") {
      const zoekDetail$ = detail =>
        this.http.get<LocatorServiceResults>(this.crabZoekerConfig.url + "/rest/geolocation/location", options(detail));

      const zoekSuggesties$ = suggestie =>
        this.http.get<SuggestionServiceResults>(this.crabZoekerConfig.url + "/rest/geolocation/suggestion", options(suggestie));

      return zoekSuggesties$(zoekterm).pipe(
        map(suggestieResultaten => from(suggestieResultaten.SuggestionResult).pipe(mergeMap(suggestie => zoekDetail$(suggestie)))),
        // mergall moet gecast worden omdat de standaard definitie fout is: https://github.com/ReactiveX/rxjs/issues/3290
        mergeAll(5) as OperatorFunction<Observable<LocatorServiceResults>, LocatorServiceResults>,
        reduce<LocatorServiceResults, ZoekResultaten>(
          (zoekResultaten, crabResultaten) => this.voegCrabResultatenToe(zoekResultaten, crabResultaten),
          new ZoekResultaten(this.naam(), [], [], this.legende)
        ),
        map(resultaten => resultaten.limiteerAantalResultaten(this.crabZoekerConfig.maxAantal))
      );
    } else if (zoekterm.type === "CrabGemeente") {
      return this.getGemeenteBBox$(zoekterm as CrabGemeente);
    } else if (zoekterm.type === "CrabStraat") {
      return this.getStraatBBox$(zoekterm as CrabStraat);
    } else if (zoekterm.type === "CrabHuisnummer") {
      return this.getHuisnummerPositie$(zoekterm as CrabHuisnummer);
    } else {
      return Observable.empty();
    }
  }
}
