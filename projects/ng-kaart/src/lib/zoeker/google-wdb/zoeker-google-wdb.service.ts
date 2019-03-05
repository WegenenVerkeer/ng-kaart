/// <reference types="@types/googlemaps" />
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { fromNullable, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { combineLatest, Observable, Observer, timer } from "rxjs";
import { catchError, concatMap, map, mergeMap, publishLast, reduce, refCount, retryWhen, switchMap, take, toArray } from "rxjs/operators";
import LatLng = google.maps.LatLng;

import { kaartLogger } from "../../kaart/log";
import { fromNullablePredicate } from "../../util/option";
import { ZOEKER_CFG, ZoekerConfigData } from "../config/zoeker-config";
import { GoogleWdbLocatieZoekerConfigData, ZoekerConfigGoogleWdbConfig } from "../config/zoeker-config-google-wdb.config";
import {
  geoJSONOptions,
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
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE, ZoekerRepresentatieType } from "../zoeker-representatie.service";

import * as help from "./zoeker-google-wdb-help";

export class GoogleWdbZoekResultaat implements ZoekResultaat {
  readonly featureIdSuffix: string;
  readonly omschrijving: string;
  readonly bron: string;
  readonly kaartInfo: Option<ZoekKaartResultaat>;
  readonly preferredPointZoomLevel: Option<number>;
  readonly extraOmschrijving: Option<string>;
  readonly zoektype: Zoektype = "Volledig";

  constructor(
    locatie,
    index: number,
    readonly zoeker: string,
    style: ol.style.Style,
    highlightStyle: ol.style.Style,
    readonly icoon: IconDescription
  ) {
    this.featureIdSuffix = `${index + 1}`;
    const geometry = new ol.format.GeoJSON(geoJSONOptions).readGeometry(locatie.locatie);
    this.kaartInfo = some({
      geometry: geometry,
      extent: geometry.getExtent(),
      style: style,
      highlightStyle: highlightStyle
    });
    this.omschrijving = locatie.omschrijving;
    this.extraOmschrijving = fromNullable(locatie.extraOmschrijving).orElse(() =>
      fromNullablePredicate<string>(() => locatie.omschrijving !== locatie.formatted_address, locatie.formatted_address)
    );
    this.bron = locatie.bron;
    this.preferredPointZoomLevel = isWdbBron(this.bron) ? some(12) : some(10);
  }
}

const isWdbBron = function(bron) {
  return bron.startsWith("WDB") || bron.startsWith("ABBAMelda");
};

class GoogleServices {
  geocoder: google.maps.Geocoder;
  autocompleteService: google.maps.places.AutocompleteService;
  placesService: google.maps.places.PlacesService;
  boundsVlaanderen: google.maps.LatLngBounds;

  constructor() {
    this.geocoder = new google.maps.Geocoder();
    this.autocompleteService = new google.maps.places.AutocompleteService();
    this.placesService = new google.maps.places.PlacesService(document.createElement("div"));
    this.boundsVlaanderen = new google.maps.LatLngBounds(
      new google.maps.LatLng(50.67267431841986, 2.501150609710172),
      new google.maps.LatLng(51.51349525865437, 6.243524925777398)
    );
  }
}

type ExtendedResult = ExtendedGeocoderResult | ExtendedPlaceResult;

interface ExtendedGeocoderResult extends google.maps.GeocoderResult, LocatieZoekerLocatie {}

interface ExtendedPlaceResult extends google.maps.places.PlaceResult, LocatieZoekerLocatie {}

interface LocatieZoekerLocatie {
  locatie: any;
  omschrijving: string;
  bron: String; // Google | WDB | ABBAMelda | Perceel
  readonly partialMatch: boolean;
}

interface OnvolledigeLocatie {
  readonly omschrijving: string;
  readonly alleenGeocoden: boolean;
}

interface LocatieZoekerSearchResults {
  readonly errors: string[];
  readonly locaties: LocatieZoekerLocatie[];
  readonly onvolledigeLocaties: OnvolledigeLocatie[];
}

interface SpecificErrorRetryStrategyOpts {
  readonly maxRetryAttempts: number;
  readonly retryDelay: number;
  readonly errorMessagesForRetry: string[];
}

@Injectable()
export class ZoekerGoogleWdbService implements Zoeker {
  private googleWdbLocatieZoekerConfig: ZoekerConfigGoogleWdbConfig;
  private googleServicesObs: Observable<GoogleServices>;
  private legende: Map<string, IconDescription>;

  private readonly locatieZoekerUrl: string;

  private googleServicesRetryStrategy = this.specificErrorRetryStrategy({
    maxRetryAttempts: 4,
    retryDelay: 1000,
    errorMessagesForRetry: ["OVER_QUERY_LIMIT"]
  });

  constructor(
    private readonly httpClient: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    this.googleWdbLocatieZoekerConfig = new ZoekerConfigGoogleWdbConfig(zoekerConfigData.googleWdb);
    this.locatieZoekerUrl = this.googleWdbLocatieZoekerConfig.url;
    this.legende = new Map([
      ["Google Locatiezoeker", this.zoekerRepresentatie.getSvgIcon("Google")],
      ["WDB Locatiezoeker", this.zoekerRepresentatie.getSvgIcon("WDB")]
    ]);
    this.googleServicesObs = Observable.create((observer: Observer<GoogleServices>) => {
      // Eerste keer, laad de google api en wacht op __onGoogleLoaded event
      window["__onGoogleLoaded"] = ev => {
        observer.next(new GoogleServices());
        observer.complete();
      };
      this.loadScript();
    }).pipe(
      publishLast(),
      refCount()
    );
  }

  naam(): string {
    return "Google/WDB LocatieZoeker";
  }

  setGoogleWdbLocatieZoekerConfigData(googleWdbLocatieZoekerConfigData: GoogleWdbLocatieZoekerConfigData) {
    this.googleWdbLocatieZoekerConfig = new ZoekerConfigGoogleWdbConfig(googleWdbLocatieZoekerConfigData);
  }
  zoekresultaten$(opdracht: Zoekopdracht): rx.Observable<ZoekAntwoord> {
    switch (opdracht.zoektype) {
      case "Volledig":
        return this.zoek$(opdracht.zoekpatroon, "Volledig", this.googleWdbLocatieZoekerConfig.maxAantal);
      default:
        return this.zoek$(opdracht.zoekpatroon, "Suggesties", 5);
    }
  }

  help(helpBoom: ZoekerHelpBoom) {
    helpBoom.voegItemToe(help.vrijAdres, "een locatie", "een adres", "Vrij adres");
    helpBoom.voegItemToe(help.identPlusRefpunt, "een locatie", "een weglocatie (ident8)", "Ident2 of ident8, referentiepunt en afstand");
    helpBoom.voegItemToe(help.identPlusHuisnummer, "een locatie", "een weglocatie (ident8)", "Ident2 of ident8, huisnummer en gemeente");
    helpBoom.voegItemToe(help.eNummer, "een locatie", "een weglocatie (ident8)", "Europese wegnummer, referentiepunt en afstand");

    // Extra leeg level hier omdat poi in zijn eigen submenu moet komen, anders komt de content daarvan mee onde "een locatie".
    helpBoom.voegItemToe(help.poi, "een locatie", "een point of interest", "");

    helpBoom.voegItemToe(help.emInstallatie, "een wegaanhorigheid", "em-installatie");
    helpBoom.voegItemToe(help.kunstwerk, "een wegaanhorigheid", "kunstwerk (brug of tunnel)");
  }

  private zoek$(zoekterm: ZoekInput, zoektype: Zoektype, maxResultaten: number): rx.Observable<ZoekAntwoord> {
    switch (zoekterm.type) {
      case "string":
        if (!zoekterm.value || zoekterm.value.trim().length === 0) {
          return rx.of(new ZoekAntwoord(this.naam(), "Volledig", [], [], this.legende));
        }
        const body = new URLSearchParams();
        body.set("query", zoekterm.value);
        body.set("legacy", "false");

        const options = {
          headers: new HttpHeaders().set("Content-Type", "application/x-www-form-urlencoded")
        };

        return this.httpClient.post<LocatieZoekerSearchResults>(this.locatieZoekerUrl + "/zoek", body.toString(), options).pipe(
          switchMap(resp => this.parseResult(resp, zoektype, maxResultaten)),
          catchError(err => this.handleError(err, zoektype))
        );
      default:
        return rx.of(nietOndersteund(this.naam(), "Volledig"));
    }
  }

  private vervolledigResultaat(onvolledigeLocatie: OnvolledigeLocatie): Observable<Array<ExtendedResult>> {
    const omschrijving = onvolledigeLocatie.omschrijving;

    if (onvolledigeLocatie.alleenGeocoden === true) {
      return this.geocode(omschrijving);
    } else {
      const placesSearchObs: Observable<ExtendedPlaceResult[]> = this.getPlacesTextSearch(omschrijving);

      const predictionsObs: Observable<ExtendedGeocoderResult[]> = this.getAutocompleteQueryPredictions(omschrijving).pipe(
        concatMap(predictions => {
          return rx.of(...predictions).pipe(
            take(10), // max 10 predictions
            mergeMap(prediction => {
              return this.geocodePlace(prediction.place_id, prediction.description);
            }, 2), // geocode 2 predictions concurrently
            reduce((acc, val) => acc.concat(val), []) // verzamel geocoded predictions in 1 'next'
          );
        })
      );

      const placesAndPredictionsObs = combineLatest(placesSearchObs, predictionsObs).pipe(
        switchMap(([places, predictions]) => {
          const alleResultaten: Array<ExtendedResult> = [];
          const besteResultaten: Array<ExtendedResult> = [];
          const establishments: Array<ExtendedResult> = [];

          const ongeveerZelfdeLocatie: (bestaande: LatLng, nieuw: LatLng) => boolean = (bestaande, nieuw) => {
            return Math.abs(bestaande.lng() - nieuw.lng()) < 0.001 && Math.abs(bestaande.lat() - nieuw.lat()) < 0.001;
          };

          const voegToe = nieuw => {
            const zitErAlIn =
              alleResultaten.find(bestaande => ongeveerZelfdeLocatie(bestaande.geometry.location, nieuw.geometry.location)) !== undefined;
            if (!zitErAlIn) {
              alleResultaten.push(nieuw);
              if (nieuw.types.indexOf("establishment") > -1) {
                establishments.push(nieuw);
              } else {
                besteResultaten.push(nieuw);
              }
            }
          };

          places.forEach(voegToe);
          predictions.forEach(voegToe);

          const besteResultatenMetGeometrieObs = rx.of(...besteResultaten).pipe(
            concatMap(r => {
              return this.loadGemeenteGeometrie(r);
            }),
            toArray() // verzamel alle beste resultaten met geometrie in 1 'next'
          );

          return rx.concat(besteResultatenMetGeometrieObs, rx.of(establishments)).pipe(
            reduce((acc, val) => acc.concat(val), [] as ExtendedResult[]) // verzamel beste resultaten en establishments in 1 'next'
          );
        })
      );

      return <Observable<Array<ExtendedResult>>>placesAndPredictionsObs;
    }
  }

  private parseResult(resultaten: LocatieZoekerSearchResults, zoektype: Zoektype, maxResultaten: number): rx.Observable<ZoekAntwoord> {
    const zoekResultaten = new ZoekAntwoord(this.naam(), zoektype, [], [], this.legende);

    // voeg eventuele foutboodschappen toe
    resultaten.errors.forEach(error => zoekResultaten.fouten.push("Fout: " + error));

    // indien geen locaties gevonden, toon melding
    if (resultaten.locaties.length === 0 && resultaten.onvolledigeLocaties.length === 0) {
      zoekResultaten.fouten.push("Geen locaties gevonden");
      return rx.of(zoekResultaten);
    } else {
      return rx.of(...resultaten.onvolledigeLocaties).pipe(
        concatMap(r => this.vervolledigResultaat(r)),
        reduce((acc, val) => acc.concat(val), [] as ExtendedResult[]), // verzamel alle vervolledigde resultaten in 1 'next'
        map(resultaten => {
          return resultaten.map(resultaat => {
            resultaat.locatie =
              resultaat.locatie || this.wgs84ToLambert72GeoJson(resultaat.geometry.location.lng(), resultaat.geometry.location.lat());
            return resultaat;
          });
        }),
        map(vervolledigdeLocaties => {
          const locaties = resultaten.locaties.concat(vervolledigdeLocaties);
          locaties.forEach((locatie, index) => {
            const zoekerType: ZoekerRepresentatieType = locatie.bron === "Perceel" ? "Perceel" : isWdbBron(locatie.bron) ? "WDB" : "Google";
            zoekResultaten.resultaten.push(
              new GoogleWdbZoekResultaat(
                locatie,
                index,
                this.naam(),
                this.zoekerRepresentatie.getOlStyle(zoekerType),
                this.zoekerRepresentatie.getHighlightOlStyle(zoekerType),
                this.zoekerRepresentatie.getSvgIcon(zoekerType)
              )
            );
          });
          return zoekResultaten.limiteerAantalResultaten(maxResultaten);
        })
      );
    }
  }

  handleError(response: Response | any, zoektype: Zoektype): rx.Observable<ZoekAntwoord> {
    let error: string;
    switch (response.status) {
      case 404:
        error = "Locatiezoeker service werd niet gevonden";
        break;
      default:
        // toon http foutmelding indien geen 200 teruggehad
        error = `Fout bij opvragen locatie: ${response.responseText || response.statusText || response}`;
    }
    return rx.of(new ZoekAntwoord(this.naam(), zoektype, [error], [], this.legende));
  }

  private geocode(omschrijving: string): Observable<ExtendedGeocoderResult[]> {
    return this.googleServicesObs.pipe(
      mergeMap(googleServices => {
        return Observable.create((observer: Observer<ExtendedGeocoderResult[]>) => {
          googleServices.geocoder.geocode(
            {
              address: omschrijving
            },
            (results: google.maps.GeocoderResult[], status: google.maps.GeocoderStatus) => {
              if (status === google.maps.GeocoderStatus.OK) {
                observer.next(
                  results
                    .map(result => <ExtendedGeocoderResult>result)
                    .map(result => {
                      result.omschrijving = result.formatted_address;
                      result.bron = "WDB/Google Geocode";
                      return result;
                    })
                );
                observer.complete();
              } else {
                if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
                  observer.complete();
                } else {
                  observer.error(status);
                }
              }
            }
          );
        });
      }),
      retryWhen<ExtendedGeocoderResult[]>(this.googleServicesRetryStrategy)
    );
  }

  private getAutocompleteQueryPredictions(omschrijving: string): Observable<google.maps.places.QueryAutocompletePrediction[]> {
    return this.googleServicesObs.pipe(
      mergeMap(googleServices => {
        return Observable.create((observer: Observer<google.maps.places.QueryAutocompletePrediction[]>) => {
          googleServices.autocompleteService.getQueryPredictions(
            {
              input: omschrijving + ", Belgie",
              bounds: googleServices.boundsVlaanderen
            },
            (predictions, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                observer.next(predictions.filter(prediction => prediction.description.indexOf("in de buurt van") === -1));
                observer.complete();
              } else {
                if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                  observer.next([]);
                  observer.complete();
                } else {
                  observer.error(status);
                }
              }
            }
          );
        });
      }),
      retryWhen<google.maps.places.QueryAutocompletePrediction[]>(this.googleServicesRetryStrategy)
    );
  }

  private getPlacesTextSearch(omschrijving: string): Observable<ExtendedPlaceResult[]> {
    return this.googleServicesObs.pipe(
      mergeMap(googleServices => {
        return Observable.create((observer: Observer<ExtendedPlaceResult[]>) => {
          googleServices.placesService.textSearch(
            {
              query: omschrijving + ", Belgie",
              bounds: googleServices.boundsVlaanderen,
              type: "address"
            },
            (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                observer.next(
                  results
                    .map(result => <ExtendedPlaceResult>result)
                    .map(result => {
                      if (result.formatted_address.indexOf(result.name) > -1) {
                        result.omschrijving = result.formatted_address;
                      } else {
                        result.omschrijving = `${result.name}, ${result.formatted_address}`;
                      }
                      result.bron = "Google Places";
                      return result;
                    })
                    .filter(result => googleServices.boundsVlaanderen.contains(result.geometry.location))
                );
                observer.complete();
              } else {
                if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                  observer.next([]);
                  observer.complete();
                } else {
                  observer.error(status);
                }
              }
            }
          );
        });
      }),
      retryWhen<ExtendedPlaceResult[]>(this.googleServicesRetryStrategy)
    );
  }

  private getPlaceDetails(placeId): Observable<ExtendedPlaceResult[]> {
    return this.googleServicesObs.pipe(
      mergeMap(googleServices => {
        return Observable.create((observer: Observer<ExtendedPlaceResult[]>) => {
          googleServices.placesService.getDetails(
            {
              placeId: placeId
            },
            (result, status) => {
              const place = <ExtendedPlaceResult>result;
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                if (place.formatted_address.indexOf(place.name) > -1) {
                  place.omschrijving = place.formatted_address;
                } else {
                  place.omschrijving = `${place.name}, ${place.formatted_address}`;
                }
                place.bron = "Google Autocomplete";
                if (googleServices.boundsVlaanderen.contains(place.geometry.location)) {
                  observer.next([place]);
                } else {
                  observer.next([]);
                }
                observer.complete();
              } else {
                observer.error(status);
              }
            }
          );
        });
      }),
      retryWhen<ExtendedPlaceResult[]>(this.googleServicesRetryStrategy)
    );
  }

  private geocodePlace(placeId: string, omschrijving: string): Observable<ExtendedGeocoderResult[]> {
    if (placeId) {
      return this.googleServicesObs.pipe(
        mergeMap(googleServices => {
          return Observable.create((observer: Observer<ExtendedGeocoderResult[]>) => {
            googleServices.geocoder.geocode(
              {
                placeId: placeId
              },
              (results, status) => {
                if (status === google.maps.GeocoderStatus.OK) {
                  observer.next(
                    results
                      .map(result => <ExtendedGeocoderResult>result)
                      .map(result => {
                        if (result.types.indexOf("political") > -1) {
                          result.omschrijving = result.formatted_address;
                        } else {
                          result.omschrijving = omschrijving;
                        }
                        result.bron = "Google Autocomplete/Geocode";
                        return result;
                      })
                  );
                  observer.complete();
                } else {
                  if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
                    observer.complete();
                  } else {
                    observer.error(status);
                  }
                }
              }
            );
          });
        }),
        retryWhen<ExtendedGeocoderResult[]>(this.googleServicesRetryStrategy)
      );
    } else {
      return rx.EMPTY;
    }
  }

  private loadGemeenteGeometrie(resultaat: ExtendedResult): Observable<ExtendedResult> {
    const isGemeente = resultaat.types.indexOf("locality") > -1;
    const isDeelgemeente = resultaat.types.indexOf("sublocality") > -1;

    if (isGemeente || isDeelgemeente) {
      let gemeenteNaam;
      if (resultaat.address_components != null) {
        const shortNames = resultaat.address_components
          .filter(address_component => address_component.types.indexOf("locality") > -1)
          .map(address_component => address_component.short_name);
        gemeenteNaam = shortNames[0];
      }
      gemeenteNaam = gemeenteNaam || resultaat["name"];

      if (gemeenteNaam) {
        const url =
          `${this.locatieZoekerUrl}/gemeente?naam=${gemeenteNaam}` +
          `&latLng=${resultaat.geometry.location.lat()},${resultaat.geometry.location.lng()}` +
          `&isGemeente=${isGemeente}&isDeelgemeente=${isDeelgemeente}`;
        return this.httpClient.get(url).pipe(
          map(res => {
            resultaat.locatie = res;
            return resultaat;
          })
        );
      } else {
        return rx.of(resultaat);
      }
    } else {
      return rx.of(resultaat);
    }
  }

  private wgs84ToLambert72GeoJson(lon, lat) {
    const mercatorlonlat = ol.proj.transform([lon, lat], "EPSG:4326", "EPSG:31370");
    const writer = new ol.format.GeoJSON();
    return JSON.parse(writer.writeGeometry(new ol.geom.Point(mercatorlonlat)));
  }

  private loadScript() {
    const node = document.createElement("script");
    node.src = `https://maps.googleapis.com/maps/api/js?key=${
      this.googleWdbLocatieZoekerConfig.apiKey
    }&libraries=places&language=nl&callback=__onGoogleLoaded`;
    node.type = "text/javascript";
    document.getElementsByTagName("head")[0].appendChild(node);
  }

  private specificErrorRetryStrategy(opts: SpecificErrorRetryStrategyOpts): (attempts: Observable<any>) => Observable<number> {
    return (attempts: Observable<any>) => {
      return attempts.pipe(
        mergeMap((error, i) => {
          const retryAttempt = i + 1;
          // if maximum number of retries have been met
          // or response is not an error message we wish to retry, throw error
          if (retryAttempt > opts.maxRetryAttempts || !opts.errorMessagesForRetry.find(e => e === error)) {
            kaartLogger.warn(`Retry: error na ${retryAttempt} pogingen: ${error}`);
            return rx.throwError(error);
          }
          kaartLogger.info(`Retry: poging ${retryAttempt}: probeer opnieuw in ${opts.retryDelay}ms`);
          return timer(opts.retryDelay);
        })
      );
    };
  }
}
