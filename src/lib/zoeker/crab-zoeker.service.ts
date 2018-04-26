import { HttpClient, HttpParams } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { MatIconRegistry } from "@angular/material";
import { DomSanitizer } from "@angular/platform-browser";
import { Map } from "immutable";
import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";
import { from } from "rxjs/observable/from";
import { map, mergeMap, reduce } from "rxjs/operators";

import { AbstractZoeker, ZoekResultaat, ZoekResultaten } from "./abstract-zoeker";
import { CrabZoekerConfig } from "./crab-zoeker.config";
import { ZOEKER_CFG, ZoekerConfigData } from "./zoeker.config";
import { pin_c_vierkant, pin_data, pin_ol } from "./zoeker.icons";

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

export class CrabZoekResultaat implements ZoekResultaat {
  partialMatch = false;
  index: number;
  omschrijving: string;
  bron: string;
  zoeker: string;
  geometry: any;
  locatie: any;
  icoon: string; // Ieder zoekresultaat heeft hetzelfde icoon.
  style: ol.style.Style;

  constructor(locatie: LocatorServiceResult, index: number, zoeker: string, icoon: string, style: ol.style.Style) {
    this.index = index + 1;
    this.geometry = new ol.geom.Point([locatie.Location.X_Lambert72, locatie.Location.Y_Lambert72]);
    this.locatie = new ol.format.GeoJSON(<ol.olx.format.GeoJSONOptions>{
      ignoreExtraDims: true,
      defaultDataProjection: undefined,
      featureProjection: undefined
    }).writeGeometry(this.geometry);
    this.omschrijving = locatie.FormattedAddress;
    this.bron = locatie.LocationType;
    this.zoeker = zoeker;
    this.icoon = icoon;
    this.style = style;
  }
}

@Injectable()
export class CrabZoekerService implements AbstractZoeker {
  private readonly crabZoekerConfig: CrabZoekerConfig;
  private style: ol.style.Style; // 1 style voor ieder resultaat. We maken geen onderscheid per bron.
  private legende: Map<string, string>;
  private icoon: string;

  constructor(
    private readonly http: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    private matIconRegistry: MatIconRegistry,
    private readonly sanitizer: DomSanitizer
  ) {
    this.matIconRegistry.addSvgIcon("pin_c_vierkant", this.sanitizer.bypassSecurityTrustResourceUrl(pin_data(pin_c_vierkant)));
    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.crab);
    this.icoon = "pin_c_vierkant";
    this.legende = Map.of(this.naam(), this.icoon);
    this.style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: this.crabZoekerConfig.kleur,
        width: 1
      }),
      fill: new ol.style.Fill({
        color: this.crabZoekerConfig.kleur
      }),
      image: new ol.style.Icon({
        anchor: [0.5, 1.0],
        src: pin_ol(pin_c_vierkant, this.crabZoekerConfig.kleur)
      })
    });
  }

  naam(): string {
    return "CRAB";
  }

  private voegCrabResultatenToe(result: ZoekResultaten, crabResultaten: LocatorServiceResults): ZoekResultaten {
    const startIndex = result.resultaten.length;
    result.resultaten = result.resultaten.concat(
      crabResultaten.LocationResult.map(
        (crabResultaat, index) => new CrabZoekResultaat(crabResultaat, startIndex + index, this.naam(), this.icoon, this.style)
      )
    );
    return result;
  }

  private maakZoekResultaten(): ZoekResultaten {
    const zoekResultaten = new ZoekResultaten(this.naam());
    zoekResultaten.legende = this.legende;
    return zoekResultaten;
  }

  private zoekDetail(zoekterm: string): Observable<LocatorServiceResults> {
    const options = { params: new HttpParams().set("query", zoekterm) };

    return this.http.get<LocatorServiceResults>(this.crabZoekerConfig.url + "/rest/geolocation/location", options);
  }

  private zoekSuggesties(zoekterm: string): Observable<SuggestionServiceResults> {
    const options = { params: new HttpParams().set("query", zoekterm) };

    return this.http.get<SuggestionServiceResults>(this.crabZoekerConfig.url + "/rest/geolocation/suggestion", options);
  }

  private limiteerAantalResultaten(zoekResultaten: ZoekResultaten): ZoekResultaten {
    if (zoekResultaten.resultaten.length >= this.crabZoekerConfig.maxAantal) {
      zoekResultaten.fouten.push(
        `Er werden meer dan ${this.crabZoekerConfig.maxAantal} resultaten gevonden, ` +
          `de eerste ${this.crabZoekerConfig.maxAantal} worden hier opgelijst`
      );
    }
    zoekResultaten.resultaten = zoekResultaten.resultaten.slice(0, this.crabZoekerConfig.maxAantal);
    return zoekResultaten;
  }

  zoek(zoekterm: string): Observable<ZoekResultaten> {
    const options = { params: new HttpParams().set("query", zoekterm) };

    return this.zoekSuggesties(zoekterm)
      .pipe(
        map(suggestieResultaten =>
          from(suggestieResultaten.SuggestionResult).pipe(
            mergeMap(suggestie => <Observable<LocatorServiceResults>>this.zoekDetail(suggestie))
          )
        )
      )
      .mergeAll()
      .pipe(
        reduce<LocatorServiceResults, ZoekResultaten>(
          (zoekResultaten, crabResultaten) => this.voegCrabResultatenToe(zoekResultaten, crabResultaten),
          this.maakZoekResultaten()
        ),
        map(resultaten => this.limiteerAantalResultaten(resultaten))
      );
  }
}
