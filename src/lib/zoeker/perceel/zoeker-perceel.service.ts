import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Observable } from "rxjs/Observable";
import { map, shareReplay } from "rxjs/operators";

import { ZoekerConfigData } from "../config/zoeker-config";
import { ZoekerConfigLocatorServicesConfig } from "../config/zoeker-config-locator-services.config";
import {
  geoJSONOptions,
  IconDescription,
  Zoeker,
  ZoekerBase,
  ZoekInput,
  ZoekKaartResultaat,
  ZoekResultaat,
  ZoekResultaten
} from "../zoeker";
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE } from "../zoeker-representatie.service";

export const PERCEEL_SVC_NAAM = "Perceel";

export interface Gemeente {
  readonly niscode: number;
  readonly naam: string;
}

export interface Afdeling {
  readonly niscode: number;
  readonly code: string;
  readonly naam: string;
}

export interface Sectie {
  readonly niscode: number;
  readonly afdelingcode: string;
  readonly code: string;
}

export interface PerceelNummer {
  readonly capakey: string;
  readonly perceelsnummer: string;
}

export interface Perceel {
  readonly capakey: string;
  readonly perceelsnummer: string;
}

export interface PerceelDetails {
  readonly macht: string;
  readonly capakey: string;
  readonly sectiecode: string;
  readonly grondnummer: string;
  readonly afdelingcode: string;
  readonly bisnummer: string;
  readonly niscode: string;
  readonly perceelsnummer: string;
  readonly exponent: string;
  readonly shape: string;
  readonly boundingbox: string;
  readonly center: string;
}

export interface PerceelZoekInput extends ZoekInput {
  type: "Perceel";
  capaKey: string;
}

export class PerceelZoekResultaat implements ZoekResultaat {
  readonly partialMatch = false;
  readonly index: number;
  readonly omschrijving: string;
  readonly bron: string = "Perceel";
  readonly kaartInfo: Option<ZoekKaartResultaat>;
  readonly preferredPointZoomLevel = none;

  constructor(
    details: PerceelDetails,
    index: number,
    readonly zoeker: string,
    readonly icoon: IconDescription,
    style: ol.style.Style,
    highlightStyle: ol.style.Style
  ) {
    this.index = index + 1;
    const geometry = new ol.format.GeoJSON(geoJSONOptions).readGeometry(details.shape);
    this.kaartInfo = some({
      geometry: geometry,
      extent: geometry.getExtent(),
      style: style,
      highlightStyle: highlightStyle
    });
    this.omschrijving = details.capakey;
  }
}

@Injectable()
export class ZoekerPerceelService extends ZoekerBase implements Zoeker {
  private readonly locatorServicesConfig: ZoekerConfigLocatorServicesConfig;
  private legende: Map<string, IconDescription>;

  constructor(
    zoekPrio: number,
    suggestiePrio: number,
    private readonly http: HttpClient,
    zoekerConfigData: ZoekerConfigData,
    private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    super("Perceel", zoekPrio, suggestiePrio);
    this.locatorServicesConfig = new ZoekerConfigLocatorServicesConfig(zoekerConfigData.locatorServices);
    this.legende = Map.of(this.naam(), this.zoekerRepresentatie.getSvgIcon("Perceel"));
  }

  getAlleGemeenten$(): Observable<Gemeente[]> {
    return this.http.get<Gemeente[]>(this.locatorServicesConfig.url + "/rest/capakey/gemeenten").pipe(shareReplay(1));
  }

  getAfdelingen$(niscode: number): Observable<Afdeling[]> {
    return this.http
      .get<Afdeling[]>(this.locatorServicesConfig.url + "/rest/capakey/afdelingen/" + niscode)
      .pipe(map(afdelingen => afdelingen.map(afdeling => ({ ...afdeling, niscode: niscode }))), shareReplay(1));
  }

  getSecties$(niscode: number, afdelingcode: string): Observable<Sectie[]> {
    return this.http
      .get<Sectie[]>(this.locatorServicesConfig.url + "/rest/capakey/secties/" + niscode + "/" + afdelingcode)
      .pipe(map(secties => secties.map(sectie => ({ ...sectie, niscode: niscode, afdelingcode: afdelingcode }))), shareReplay(1));
  }

  getPerceelNummers$(niscode: number, afdelingcode: string, sectiecode: string): Observable<PerceelNummer[]> {
    return this.http
      .get<PerceelNummer[]>(
        this.locatorServicesConfig.url + "/rest/capakey/perceelsnummers/" + niscode + "/" + afdelingcode + "/" + sectiecode
      )
      .pipe(shareReplay(1));
  }

  getPerceelDetails$(capakey: string): Observable<PerceelDetails> {
    return this.http.get<PerceelDetails>(this.locatorServicesConfig.url + "/rest/capakey/perceel/" + capakey).pipe(shareReplay(1));
  }

  zoek$(zoekterm: ZoekInput): Observable<ZoekResultaten> {
    switch (zoekterm.type) {
      case "Perceel":
        return this.getPerceelDetails$((zoekterm as PerceelZoekInput).capaKey).pipe(
          map(
            details =>
              new ZoekResultaten(
                this.naam(),
                this.zoekPrioriteit(),
                [],
                [
                  new PerceelZoekResultaat(
                    details,
                    0,
                    this.naam(),
                    this.zoekerRepresentatie.getSvgIcon("Perceel"),
                    this.zoekerRepresentatie.getOlStyle("Perceel"),
                    this.zoekerRepresentatie.getHighlightOlStyle("Perceel")
                  )
                ],
                this.legende
              )
          )
        );
      default:
        return rx.Observable.empty();
    }
  }

  suggesties$(zoekterm: string): rx.Observable<ZoekResultaten> {
    return rx.Observable.empty();
  }
}
