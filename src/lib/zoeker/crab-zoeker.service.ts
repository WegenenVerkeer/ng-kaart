import { HttpClient, HttpParams } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { Map } from "immutable";
import * as ol from "openlayers";
import { OperatorFunction } from "rxjs/interfaces";
import { Observable } from "rxjs/Observable";
import { from } from "rxjs/observable/from";
import { map, mergeAll, mergeMap, reduce } from "rxjs/operators";

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

export class CrabZoekResultaat implements ZoekResultaat {
  readonly partialMatch = false;
  readonly index: number;
  readonly omschrijving: string;
  readonly bron: string;
  readonly zoeker: string;
  readonly geometry: any;
  readonly locatie: any;
  readonly icoon: string; // Ieder zoekresultaat heeft hetzelfde icoon.
  readonly style: ol.style.Style;

  constructor(locatie: LocatorServiceResult, index: number, zoeker: string, icoon: string, style: ol.style.Style) {
    this.index = index + 1;
    this.geometry = new ol.geom.Point([locatie.Location.X_Lambert72, locatie.Location.Y_Lambert72]);
    this.locatie = new ol.format.GeoJSON(geoJSONOptions).writeGeometry(this.geometry);
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
      // We willen geen gemeenten van CRAB zien, we hebben daar toch alleen het middelpunt van. google geeft een beter resultaat.
      crabResultaten.LocationResult
        // Waarschijnlijk gaan we de crab gemeenten niet laten zien,
        //  we hebben daar toch alleen het middelpunt van. Google geeft een beter resultaat.
        //  Maar voorlopig zitten ze er nog in, de gebruikers moeten beslissen.
        // .filter(crabResultaat => crabResultaat.LocationType !== "crab_gemeente")
        .map(
          (crabResultaat, index) =>
            new CrabZoekResultaat(
              crabResultaat,
              startIndex + index,
              this.naam(),
              this.zoekerRepresentatie.getSvgNaam("Crab"),
              this.zoekerRepresentatie.getOlStyle("Crab")
            )
        )
    );
    return result;
  }

  zoek$(zoekterm: string): Observable<ZoekResultaten> {
    function options(waarde) {
      return {
        params: new HttpParams().set("query", waarde)
      };
    }

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
  }
}
