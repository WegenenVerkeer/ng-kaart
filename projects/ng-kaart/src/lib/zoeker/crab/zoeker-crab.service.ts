import { HttpClient, HttpParams } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { catchError, map, mergeAll, mergeMap, reduce, shareReplay } from "rxjs/operators";

import { ZOEKER_CFG, ZoekerConfigData } from "../config/zoeker-config";
import { ZoekerConfigLocatorServicesConfig } from "../config/zoeker-config-locator-services.config";
import {
  IconDescription,
  nietOndersteund,
  ZoekAntwoord,
  Zoeker,
  ZoekerHelpBoom,
  ZoekInput,
  ZoekKaartResultaat,
  Zoekopdracht,
  ZoekResultaat,
  Zoektype
} from "../zoeker";
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE } from "../zoeker-representatie.service";

import * as help from "./zoeker-crab-help";

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

// De data zoals we ze van de service krijgen. Zou beter via RAML gaan,
// maar dat heeft enkel zin wanneer ook de backend die RAML gebruikt.

export interface CrabGemeenteData {
  readonly postcodes: string;
  readonly niscode: number;
  readonly naam: string;
  readonly id: number;
}

export interface CrabStraatData {
  readonly naam: string;
  readonly id: number;
}

export interface CrabHuisnummerData {
  readonly huisnummer: string;
  readonly id: number;
}

interface CrabBBoxData {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumY: number;
  readonly maximumY: number;
}

interface CrabPositieData {
  readonly x: number;
  readonly y: number;
}

// De verrijkte data die uit de observables komt en ook als input kan dienen voor de zoek$ functie.

export interface CrabZoekInput extends ZoekInput {
  readonly type: "CrabGemeente" | "CrabStraat" | "CrabHuisnummer";
}

export class CrabGemeente implements CrabZoekInput {
  readonly type: "CrabGemeente";
  readonly postcodes: string;
  readonly niscode: number;
  readonly naam: string;
  readonly id: number;

  constructor(data: CrabGemeenteData) {
    this.type = "CrabGemeente";
    this.postcodes = data.postcodes;
    this.niscode = data.niscode;
    this.naam = data.naam;
    this.id = data.id;
  }
}

export class CrabStraat implements CrabZoekInput {
  readonly type: "CrabStraat";
  readonly naam: string;
  readonly id: number;

  constructor(public gemeente: CrabGemeente, data: CrabStraatData) {
    this.type = "CrabStraat";
    this.naam = data.naam;
    this.id = data.id;
  }
}

export class CrabHuisnummer implements CrabZoekInput {
  readonly type: "CrabHuisnummer";
  readonly huisnummer: string;
  readonly id: number;

  constructor(public straat: CrabStraat, data: CrabHuisnummerData) {
    this.type = "CrabHuisnummer";
    this.huisnummer = data.huisnummer;
    this.id = data.id;
  }
}

export class CrabZoekResultaat implements ZoekResultaat {
  readonly featureIdSuffix: string;
  readonly kaartInfo: Option<ZoekKaartResultaat>;
  readonly preferredPointZoomLevel = some(10);
  readonly extraOmschrijving: Option<string> = none;

  constructor(
    x_lambert_72: number,
    y_lambert_72: number,
    readonly omschrijving: string,
    readonly bron: string,
    index: number,
    readonly zoeker: string,
    readonly icoon: IconDescription,
    style: ol.style.Style,
    highlightStyle: ol.style.Style,
    extent?: ol.Extent
  ) {
    this.featureIdSuffix = `${index + 1}`;
    const geometry = new ol.geom.Point([x_lambert_72, y_lambert_72]);
    this.kaartInfo = some({
      style: style,
      highlightStyle: highlightStyle,
      geometry: geometry,
      extent: extent ? extent : geometry.getExtent()
    });
  }
}

@Injectable()
export class ZoekerCrabService implements Zoeker {
  private readonly locatorServicesConfig: ZoekerConfigLocatorServicesConfig;
  private legende: Map<string, IconDescription>;

  constructor(
    private readonly http: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    this.locatorServicesConfig = new ZoekerConfigLocatorServicesConfig(zoekerConfigData.locatorServices);
    this.legende = new Map([[this.naam(), this.zoekerRepresentatie.getSvgIcon("Crab")]]);
  }

  naam(): string {
    return "Crab";
  }

  help(helpBoom: ZoekerHelpBoom) {
    helpBoom.voegItemToe(help.getrapt, "een locatie", "een adres", "Getrapt zoeken naar een adres");
  }

  private voegCrabResultatenToe(result: ZoekAntwoord, crabResultaten: LocatorServiceResults): ZoekAntwoord {
    const startIndex = result.resultaten.length;
    const resultaten = result.resultaten.concat(
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
              this.zoekerRepresentatie.getSvgIcon("Crab"),
              this.zoekerRepresentatie.getOlStyle("Crab"),
              this.zoekerRepresentatie.getHighlightOlStyle("Crab")
            )
        )
    );
    return new ZoekAntwoord(result.zoeker, result.zoektype, result.fouten, resultaten, result.legende);
  }

  getAlleGemeenten$(): rx.Observable<CrabGemeente[]> {
    return this.http
      .get<CrabGemeenteData[]>(this.locatorServicesConfig.url + "/rest/crab/gemeenten")
      .pipe(map(gemeentes => gemeentes.map(gemeente => new CrabGemeente(gemeente)), shareReplay(1)));
  }

  private bboxNaarZoekResultaat(naam: string, bron: string, bbox: CrabBBoxData): CrabZoekResultaat {
    const extent: ol.Extent = [bbox.minimumX, bbox.minimumY, bbox.maximumX, bbox.maximumY];
    const middlePoint = ol.extent.getCenter(extent);
    return new CrabZoekResultaat(
      middlePoint[0],
      middlePoint[1],
      naam,
      bron,
      0,
      this.naam(),
      this.zoekerRepresentatie.getSvgIcon("Crab"),
      this.zoekerRepresentatie.getOlStyle("Crab"),
      this.zoekerRepresentatie.getHighlightOlStyle("Crab"),
      extent
    );
  }

  private positieNaarZoekResultaat(naam: string, bron: string, pos: CrabPositieData): CrabZoekResultaat {
    return new CrabZoekResultaat(
      pos.x,
      pos.y,
      naam,
      bron,
      0,
      this.naam(),
      this.zoekerRepresentatie.getSvgIcon("Crab"),
      this.zoekerRepresentatie.getOlStyle("Crab"),
      this.zoekerRepresentatie.getHighlightOlStyle("Crab")
    );
  }

  private getGemeenteBBox$(gemeente: CrabGemeente): rx.Observable<ZoekAntwoord> {
    return this.http.get<CrabBBoxData>(this.locatorServicesConfig.url + "/rest/crab/gemeente/" + gemeente.niscode).pipe(
      map(
        bbox =>
          new ZoekAntwoord(this.naam(), "Volledig", [], [this.bboxNaarZoekResultaat(gemeente.naam, "CrabGemeente", bbox)], this.legende)
      ),
      shareReplay(1)
    );
  }

  getStraten$(gemeente: CrabGemeente): rx.Observable<CrabStraat[]> {
    return this.http.get<CrabStraatData[]>(this.locatorServicesConfig.url + "/rest/crab/straten/" + gemeente.niscode).pipe(
      map(straten => straten.map(straat => new CrabStraat(gemeente, straat))),
      shareReplay(1)
    );
  }

  private getStraatBBox$(straat: CrabStraat): rx.Observable<ZoekAntwoord> {
    return this.http.get<CrabBBoxData>(this.locatorServicesConfig.url + "/rest/crab/straat/" + straat.id).pipe(
      map(
        bbox =>
          new ZoekAntwoord(
            this.naam(),
            "Volledig",
            [],
            [this.bboxNaarZoekResultaat(`${straat.naam}, ${straat.gemeente.naam}`, "CrabStraat", bbox)],
            this.legende
          )
      ),
      shareReplay(1)
    );
  }

  getHuisnummers$(straat: CrabStraat): rx.Observable<CrabHuisnummer[]> {
    return this.http.get<CrabHuisnummerData[]>(this.locatorServicesConfig.url + "/rest/crab/huisnummers/" + straat.id).pipe(
      map(huisnummers => huisnummers.map(huisnummer => new CrabHuisnummer(straat, huisnummer))),
      shareReplay(1)
    );
  }

  private getHuisnummerPositie$(huisnummer: CrabHuisnummer): rx.Observable<ZoekAntwoord> {
    return this.http
      .get<CrabPositieData>(this.locatorServicesConfig.url + "/rest/crab/huisnummer/" + huisnummer.straat.id + "/" + huisnummer.huisnummer)
      .pipe(
        map(
          positie =>
            new ZoekAntwoord(
              this.naam(),
              "Volledig",
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

  zoekresultaten$(zoekopdracht: Zoekopdracht): rx.Observable<ZoekAntwoord> {
    switch (zoekopdracht.zoektype) {
      case "Volledig":
        return this.zoek$(zoekopdracht.zoekpatroon);
      case "Suggesties":
        return this.suggesties$(zoekopdracht.zoekpatroon);
    }
  }

  private zoek$(zoekinput: ZoekInput): rx.Observable<ZoekAntwoord> {
    switch (zoekinput.type) {
      case "string":
        return this.tekstzoekResultaten(zoekinput.value, "Volledig", this.locatorServicesConfig.maxAantal);
      case "CrabGemeente":
        return this.getGemeenteBBox$(zoekinput as CrabGemeente);
      case "CrabStraat":
        return this.getStraatBBox$(zoekinput as CrabStraat);
      case "CrabHuisnummer":
        return this.getHuisnummerPositie$(zoekinput as CrabHuisnummer);
      default:
        return rx.of(nietOndersteund(this.naam(), "Volledig"));
    }
  }

  private suggesties$(zoekinput: ZoekInput): rx.Observable<ZoekAntwoord> {
    switch (zoekinput.type) {
      case "string":
        return this.tekstzoekResultaten(zoekinput.value, "Suggesties", 5);
      default:
        return rx.of(nietOndersteund(this.naam(), "Suggesties"));
    }
  }

  private tekstzoekResultaten(zoekterm: string, zoektype: Zoektype, maxResultaten: number): rx.Observable<ZoekAntwoord> {
    const options = waarde => ({ params: new HttpParams().set("query", waarde) });

    const zoekDetail$ = detail =>
      this.http.get<LocatorServiceResults>(this.locatorServicesConfig.url + "/rest/geolocation/location", options(detail));

    const zoekSuggesties$ = suggestie =>
      this.http.get<SuggestionServiceResults>(this.locatorServicesConfig.url + "/rest/geolocation/suggestion", options(suggestie));

    return zoekSuggesties$(zoekterm).pipe(
      map(
        suggestieResultaten =>
          rx
            .from(suggestieResultaten.SuggestionResult.slice(0, maxResultaten)) // niet meer details opvragen dan we nodig hebben
            .pipe(mergeMap(suggestie => zoekDetail$(suggestie))) // mergeMap omdat from individueel emit (kan beter met .of en map op array)
      ),
      // mergall moet gecast worden omdat de standaard definitie fout is: https://github.com/ReactiveX/rxjs/issues/3290
      mergeAll(5),
      reduce<LocatorServiceResults, ZoekAntwoord>(
        (zoekResultaten, crabResultaten) => this.voegCrabResultatenToe(zoekResultaten, crabResultaten),
        new ZoekAntwoord(this.naam(), zoektype, [], [], this.legende)
      ),
      map(resultaten => resultaten.limiteerAantalResultaten(maxResultaten)),
      catchError(e => rx.of(new ZoekAntwoord(this.naam(), zoektype, ["Kon locator services niet aanroepen "], [])))
    );
  }
}
