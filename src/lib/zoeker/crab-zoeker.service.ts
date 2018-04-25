import { ZoekResultaat, AbstractZoeker, ZoekResultaten } from "./abstract-zoeker";
import { SafeHtml, DomSanitizer } from "@angular/platform-browser";
import * as ol from "openlayers";
import { Injectable, Inject } from "@angular/core";
import { CrabZoekerConfig } from "./crab-zoeker.config";
import { Observable } from "rxjs/Observable";
import { Http } from "@angular/http";
import { ZoekerConfigData, ZOEKER_CFG } from "./zoeker.config";
import { HttpClient, HttpParams } from "@angular/common/http";
import { map, reduce } from "rxjs/operators";
import { Map } from "immutable";

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

export class CrabZoekResultaat implements ZoekResultaat {
  partialMatch = false;
  index: number;
  omschrijving: string;
  bron: string;
  zoeker: string;
  geometry: any;
  locatie: any;
  icoon: SafeHtml; // Ieder zoekresultaat heeft hetzelfde icoon.
  style: ol.style.Style;

  constructor(locatie: LocatorServiceResult, index: number, zoeker: string, icoon: SafeHtml, style: ol.style.Style) {
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
  private legende: Map<string, SafeHtml>;
  private icoon: SafeHtml;

  constructor(
    private readonly http: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    private readonly sanitizer: DomSanitizer
  ) {
    this.crabZoekerConfig = new CrabZoekerConfig(zoekerConfigData.crab);
    this.icoon = this.sanitizer.bypassSecurityTrustHtml("<mat-icon class='mat-icon material-icons'>pin_drop</mat-icon>");
    this.legende = Map.of(this.naam(), this.icoon);
    this.style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: this.crabZoekerConfig.kleur,
        width: 1
      }),
      fill: new ol.style.Fill({
        color: this.crabZoekerConfig.kleur
      }),
      text: new ol.style.Text({
        text: "\uE55E", // place
        font: "normal 24px Material Icons",
        textBaseline: "bottom",
        fill: new ol.style.Fill({
          color: this.crabZoekerConfig.kleur
        }),
        offsetX: 0.5,
        offsetY: 1.0
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

  zoek(zoekterm: string): Observable<ZoekResultaten> {
    const options = { params: new HttpParams().set("query", zoekterm) };

    return this.http
      .get<LocatorServiceResults>(this.crabZoekerConfig.url + "/rest/geolocation/location", options)
      .pipe(
        reduce<LocatorServiceResults, ZoekResultaten>(
          (zoekResultaten, crabResultaten) => this.voegCrabResultatenToe(zoekResultaten, crabResultaten),
          this.maakZoekResultaten()
        )
      );

    /* locatorservices/rest/geolocation/suggestion?query=kerkstraat
    const res = {
      SuggestionResult: [
        "Kerkstraat, Aalst",
        "Kerkstraat, Aalter",
        "Kerkstraat, Aarschot",
        "Kerkstraat, Affligem",
        "Kerkstraat, Sint-Agatha-Berchem"
      ]
    };*/

    /* locatorservices/rest/geolocation/location?query=kerkstraat
    const res = {
      LocationResult: [
        {
          Municipality: "Aalst",
          Zipcode: "9300",
          Thoroughfarename: "Kerkstraat",
          Housenumber: null,
          ID: 61841,
          FormattedAddress: "Kerkstraat, Aalst",
          Location: { Lat_WGS84: 50.938108398029627, Lon_WGS84: 4.0400732293316519, X_Lambert72: 126897.5, Y_Lambert72: 180918.95 },
          LocationType: "crab_straat",
          BoundingBox: {
            LowerLeft: { Lat_WGS84: 50.93806641135145, Lon_WGS84: 4.0393310091158243, X_Lambert72: 126845.31, Y_Lambert72: 180914.51 },
            UpperRight: { Lat_WGS84: 50.938162860380089, Lon_WGS84: 4.0405197235360761, X_Lambert72: 126928.91, Y_Lambert72: 180924.87 }
          }
        }
      ]
    };
    */
  }
}
