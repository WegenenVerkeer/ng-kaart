import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { Option, some } from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";
import { map, shareReplay } from "rxjs/operators";

import {
  AbstractZoeker,
  FontIcon,
  geoJSONOptions,
  StringZoekInput,
  SvgIcon,
  ZoekKaartResultaat,
  ZoekResultaat,
  ZoekResultaten
} from "./abstract-zoeker";
import { CrabZoekerConfig } from "./crab-zoeker.config";
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE } from "./zoeker-representatie.service";
import { ZOEKER_CFG, ZoekerConfigData } from "./zoeker.config";

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

export class PerceelZoekResultaat implements ZoekResultaat {
  readonly partialMatch = false;
  readonly index: number;
  readonly omschrijving: string;
  readonly bron: string;
  readonly zoeker: string;
  readonly icoon: SvgIcon | FontIcon;
  readonly kaartInfo: Option<ZoekKaartResultaat>;
  readonly onclick: (res: ZoekResultaat) => void;

  constructor(details: PerceelDetails, index: number, zoeker: string, icoon: SvgIcon, style: ol.style.Style) {
    this.index = index + 1;
    const geometry = new ol.format.GeoJSON(geoJSONOptions).readGeometry(details.shape);
    this.kaartInfo = some({
      geometry: geometry,
      extent: geometry.getExtent(),
      style: style
    });
    this.omschrijving = details.capakey;
    this.bron = "Perceel";
    this.zoeker = zoeker;
    this.icoon = icoon;
    this.onclick = (r: ZoekResultaat) => {};
  }
}

@Injectable()
export class PerceelZoekerService implements AbstractZoeker {
  private readonly crabZoekerConfig: CrabZoekerConfig;
  private legende: Map<string, SvgIcon | FontIcon>;

  constructor(
    private readonly http: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.crab);
    this.legende = Map.of(this.naam(), this.zoekerRepresentatie.getSvgIcon("Perceel"));
  }

  getAlleGemeenten$(): Observable<Gemeente[]> {
    return this.http.get<Gemeente[]>(this.crabZoekerConfig.url + "/rest/capakey/gemeenten").pipe(shareReplay(1));
  }

  getAfdelingen$(niscode: number): Observable<Afdeling[]> {
    return this.http
      .get<Afdeling[]>(this.crabZoekerConfig.url + "/rest/capakey/afdelingen/" + niscode)
      .pipe(map(afdelingen => afdelingen.map(afdeling => ({ ...afdeling, niscode: niscode }))), shareReplay(1));
  }

  getSecties$(niscode: number, afdelingcode: string): Observable<Sectie[]> {
    return this.http
      .get<Sectie[]>(this.crabZoekerConfig.url + "/rest/capakey/secties/" + niscode + "/" + afdelingcode)
      .pipe(map(secties => secties.map(sectie => ({ ...sectie, niscode: niscode, afdelingcode: afdelingcode }))), shareReplay(1));
  }

  getPerceelNummers$(niscode: number, afdelingcode: string, sectiecode: string): Observable<PerceelNummer[]> {
    return this.http
      .get<PerceelNummer[]>(this.crabZoekerConfig.url + "/rest/capakey/perceelsnummers/" + niscode + "/" + afdelingcode + "/" + sectiecode)
      .pipe(shareReplay(1));
  }

  getPerceelDetails$(capakey: string): Observable<PerceelDetails> {
    return this.http.get<PerceelDetails>(this.crabZoekerConfig.url + "/rest/capakey/perceel/" + capakey).pipe(shareReplay(1));
  }

  naam(): string {
    return "Percelen";
  }

  zoek$(zoekterm: StringZoekInput): Observable<ZoekResultaten> {
    return this.getPerceelDetails$(zoekterm.value).pipe(
      map(
        details =>
          new ZoekResultaten(
            this.naam(),
            [],
            [
              new PerceelZoekResultaat(
                details,
                0,
                this.naam(),
                this.zoekerRepresentatie.getSvgIcon("Perceel"),
                this.zoekerRepresentatie.getOlStyle("Perceel")
              )
            ],
            this.legende
          )
      )
    );
  }
}
