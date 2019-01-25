import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map, shareReplay } from "rxjs/operators";

import { kaartLogger } from "../../kaart/log";
import { ZOEKER_CFG, ZoekerConfigData } from "../config/zoeker-config";
import { ZoekerConfigLocatorServicesConfig } from "../config/zoeker-config-locator-services.config";
import {
  geoJSONOptions,
  IconDescription,
  nietOndersteund,
  ZoekAntwoord,
  Zoeker,
  ZoekInput,
  ZoekKaartResultaat,
  Zoekopdracht,
  ZoekResultaat
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
  readonly featureIdSuffix: string;
  readonly omschrijving: string;
  readonly bron: string = "Perceel";
  readonly kaartInfo: Option<ZoekKaartResultaat>;
  readonly preferredPointZoomLevel = none;
  readonly extraOmschrijving: Option<string> = none;

  constructor(
    details: PerceelDetails,
    index: number,
    readonly zoeker: string,
    readonly icoon: IconDescription,
    style: ol.style.Style,
    highlightStyle: ol.style.Style
  ) {
    this.featureIdSuffix = `${index + 1}`;
    try {
      const geometry = new ol.format.GeoJSON(geoJSONOptions).readGeometry(details.shape);
      this.kaartInfo = some({
        geometry: geometry,
        extent: geometry.getExtent(),
        style: style,
        highlightStyle: highlightStyle
      });
    } catch (e) {
      kaartLogger.error("Slechte geometry", e);
    }
    this.omschrijving = details.capakey;
  }
}

@Injectable()
export class ZoekerPerceelService implements Zoeker {
  private readonly locatorServicesConfig: ZoekerConfigLocatorServicesConfig;
  private legende: Map<string, IconDescription>;

  constructor(
    private readonly http: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    this.locatorServicesConfig = new ZoekerConfigLocatorServicesConfig(zoekerConfigData.locatorServices);
    this.legende = Map.of(this.naam(), this.zoekerRepresentatie.getSvgIcon("Perceel"));
  }

  naam(): string {
    return PERCEEL_SVC_NAAM;
  }

  getAlleGemeenten$(): rx.Observable<Gemeente[]> {
    // return Observable.of([
    //   { niscode: 19000, naam: "Aalst" }, //
    //   { niscode: 19010, naam: "Erpe-Mere" },
    //   { niscode: 19020, naam: "Herzele" }
    // ]);
    return this.http.get<Gemeente[]>(this.locatorServicesConfig.url + "/rest/capakey/gemeenten").pipe(shareReplay(1));
  }

  getAfdelingen$(niscode: number): rx.Observable<Afdeling[]> {
    // return Observable.of([
    //   { niscode: 20000, code: "1002/34", naam: "Afdeling 1" }, //
    //   { niscode: 20001, code: "1002/35", naam: "Afdeling 2" },
    //   { niscode: 20002, code: "1002/36", naam: "Afdeling 3" }
    // ]);
    return this.http.get<Afdeling[]>(this.locatorServicesConfig.url + "/rest/capakey/afdelingen/" + niscode).pipe(
      map(afdelingen => afdelingen.map(afdeling => ({ ...afdeling, niscode: niscode }))),
      shareReplay(1)
    );
  }

  getSecties$(niscode: number, afdelingcode: string): rx.Observable<Sectie[]> {
    // return Observable.of([
    //   { niscode: 30000, afdelingcode: "1002/34", code: "1000-1000-10" }, //
    //   { niscode: 30000, afdelingcode: "1002/34", code: "1000-1000-11" },
    //   { niscode: 30000, afdelingcode: "1002/34", code: "1000-1000-12" }
    // ]);
    return this.http.get<Sectie[]>(this.locatorServicesConfig.url + "/rest/capakey/secties/" + niscode + "/" + afdelingcode).pipe(
      map(secties => secties.map(sectie => ({ ...sectie, niscode: niscode, afdelingcode: afdelingcode }))),
      shareReplay(1)
    );
  }

  getPerceelNummers$(niscode: number, afdelingcode: string, sectiecode: string): rx.Observable<PerceelNummer[]> {
    // return Observable.of([
    //   { capakey: "capap1", perceelsnummer: "1238712" }, //
    //   { capakey: "capap2", perceelsnummer: "1238713" },
    //   { capakey: "capap3", perceelsnummer: "1238714" }
    // ]);
    return this.http
      .get<PerceelNummer[]>(
        this.locatorServicesConfig.url + "/rest/capakey/perceelsnummers/" + niscode + "/" + afdelingcode + "/" + sectiecode
      )
      .pipe(shareReplay(1));
  }

  getPerceelDetails$(capakey: string): rx.Observable<PerceelDetails> {
    // return Observable.of({
    //   macht: "macht",
    //   capakey: "capakey",
    //   sectiecode: "sectiecode",
    //   grondnummer: "grondn",
    //   afdelingcode: "afdeling",
    //   bisnummer: "bisnummer",
    //   niscode: "niscode",
    //   perceelsnummer: "pcn",
    //   exponent: "exp",
    //   shape: "{}",
    //   boundingbox: "bbox",
    //   center: "center"
    // });
    return this.http.get<PerceelDetails>(this.locatorServicesConfig.url + "/rest/capakey/perceel/" + capakey).pipe(shareReplay(1));
  }

  zoekresultaten$(zoekopdracht: Zoekopdracht): rx.Observable<ZoekAntwoord> {
    switch (zoekopdracht.zoektype) {
      case "Volledig":
        return this.zoek$(zoekopdracht.zoekpatroon);
      default:
        return rx.of(nietOndersteund(this.naam(), zoekopdracht.zoektype));
    }
  }

  zoek$(zoekterm: ZoekInput): rx.Observable<ZoekAntwoord> {
    switch (zoekterm.type) {
      case "Perceel":
        return this.getPerceelDetails$((zoekterm as PerceelZoekInput).capaKey).pipe(
          map(
            details =>
              new ZoekAntwoord(
                this.naam(),
                "Volledig",
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
        return rx.empty();
    }
  }
}
