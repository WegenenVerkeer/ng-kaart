import { ZoekResultaat, AbstractZoeker, ZoekResultaten } from "./abstract-zoeker";
import { SafeHtml, DomSanitizer } from "@angular/platform-browser";
import * as ol from "openlayers";
import { Injectable, Inject } from "@angular/core";
import { CrabZoekerConfig } from "./crab-zoeker.config";
import { Observable } from "rxjs/Observable";
import { Http } from "@angular/http";
import { ZoekerConfigData, ZOEKER_CFG } from "./zoeker.config";

export class CrabZoekResultaat implements ZoekResultaat {
  partialMatch: boolean;
  index: number;
  omschrijving: string;
  bron: string;
  zoeker: string;
  geometry: any;
  locatie: any;
  icoon: SafeHtml; // Ieder zoekresultaat heeft hetzelfde icoon.
  style: ol.style.Style;

  constructor(locatie, index: number, zoeker: string, icoon: SafeHtml, style: ol.style.Style) {
    this.partialMatch = locatie.partialMatch;
    this.index = index + 1;
    this.locatie = locatie.locatie;
    this.geometry = new ol.format.GeoJSON(<ol.olx.format.GeoJSONOptions>{
      ignoreExtraDims: true,
      defaultDataProjection: undefined,
      featureProjection: undefined
    }).readGeometry(locatie.locatie);
    this.omschrijving = locatie.omschrijving;
    this.bron = locatie.bron;
    this.zoeker = zoeker;
    this.icoon = icoon;
    this.style = style;
  }
}

@Injectable()
export class CrabZoekerService implements AbstractZoeker {
  private readonly crabZoekerConfig: CrabZoekerConfig;

  constructor(
    private readonly http: Http,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    private readonly sanitizer: DomSanitizer
  ) {
    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.google);
  }

  naam(): string {
    return "CRAB";
  }
  zoek(zoekterm: string): Observable<ZoekResultaten> {
    throw new Error("Method not implemented.");
  }
}
