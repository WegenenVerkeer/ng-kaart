import { Function1, Function2, Function3 } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Observable } from "rxjs";
import { switchMap } from "rxjs/operators";

import * as le from "../kaart/kaart-load-events";
import { kaartLogger } from "../kaart/log";
import { fetchWithTimeout } from "../util/fetch-with-timeout";
import * as geojsonStore from "../util/geojson-store";
import { GeoJsonLike } from "../util/geojson-store";

const FETCH_TIMEOUT = 5000; // max time to wait for data from featureserver before checking cache

const format = new ol.format.GeoJSON();
const decoder = new TextDecoder();

/**
 * Stappen:

 1. Er komt een extent binnen van de kaart om de features op te vragen
 2. NosqlfsLoader gaat de features voor die extent opvragen aan featureserver
 3. Bij ontvangen van de features worden deze bewaard in een indexeddb (1 per laag), gemanaged door ng-kaart
 4. Indien NosqlfsLoader binnen 5 seconden geen antwoord heeft gekregen, worden de features uit de indexeddb gehaald

 */

const geoJsonLike: Function1<string, GeoJsonLike> = lijn => {
  try {
    const geojson = JSON.parse(lijn) as GeoJsonLike;
    geojson.metadata = {
      minx: geojson.geometry.bbox[0],
      miny: geojson.geometry.bbox[1],
      maxx: geojson.geometry.bbox[2],
      maxy: geojson.geometry.bbox[3],
      toegevoegd: new Date()
    };
    return geojson;
  } catch (error) {
    kaartLogger.error(`Kon JSON data niet parsen: ${error}`);
    throw new Error(`Kon JSON data niet parsen: ${error}`);
  }
};

const geoJsons: Function1<string[], GeoJsonLike[]> = volledigeLijnen => {
  try {
    const features = volledigeLijnen //
      .filter(lijn => lijn.trim().length > 0) //
      .map(geoJsonLike);
    return features!;
  } catch (error) {
    kaartLogger.error(`Kon JSON data niet parsen: ${error}`);
    throw new Error(`Kon JSON data niet parsen: ${error}`);
  }
};

const olFeature: Function2<string, GeoJsonLike, ol.Feature> = (laagnaam, geojson) =>
  new ol.Feature({
    id: geojson.id,
    properties: geojson.properties,
    geometry: format.readGeometry(geojson.geometry),
    laagnaam: laagnaam
  });

const observableFromResponse$: Function3<string, string, Response, Observable<GeoJsonLike>> = (collection, featureDelimiter, response) => {
  return rx.Observable.create((subscriber: rx.Subscriber<GeoJsonLike>) => {
    if (!response.ok) {
      subscriber.error(`Probleem bij ontvangen nosql ${collection} data: status ${response.status} ${response.statusText}`);
      return;
    }

    if (!response.body) {
      subscriber.error(`Probleem bij ontvangen nosql ${collection} data: response.body is leeg`);
      return;
    }

    let restData = "";
    let teParsenFeatureGroep: string[] = [];

    const reader = response.body.getReader();
    reader
      .read()
      .then(function verwerkChunk({ done, value }) {
        restData += decoder.decode(value || new Uint8Array(0), {
          stream: !done
        }); // append nieuwe data (in geval er een half ontvangen lijn is van vorige call)

        let ontvangenLijnen = restData.split(featureDelimiter);

        if (!done) {
          // laatste lijn is vermoedelijk niet compleet. Hou bij voor volgende keer
          restData = ontvangenLijnen[ontvangenLijnen.length - 1];
          // verwijder gedeeltelijke lijn
          ontvangenLijnen = ontvangenLijnen.slice(0, -1);
        }

        // verwerk in batches van 100
        teParsenFeatureGroep = teParsenFeatureGroep.concat(ontvangenLijnen);
        if (teParsenFeatureGroep.length > 100 || done) {
          geoJsons(teParsenFeatureGroep).map(geojson => subscriber.next(geojson));
          teParsenFeatureGroep = [];
        }

        if (!done) {
          reader.read().then(verwerkChunk);
        } else {
          subscriber.complete();
        }
      })
      .catch(reason => {
        subscriber.error(reason);
      });
  });
};

export class NosqlFsSource extends ol.source.Vector {
  private static readonly featureDelimiter = "\n";
  private readonly loadEventSubj = new rx.Subject<le.DataLoadEvent>();
  readonly loadEvent$: rx.Observable<le.DataLoadEvent> = this.loadEventSubj;

  constructor(
    private readonly database: string,
    private readonly collection: string,
    private readonly url = "/geolatte-nosqlfs",
    private readonly view: Option<string>,
    private readonly filter: Option<string>,
    private readonly laagnaam: string,
    private readonly gebruikCache: boolean
  ) {
    super({
      loader: function(extent) {
        const source = this;
        source.clear();
        source.dispatchLoadEvent(le.LoadStart);
        source.fetchFeatures$(extent).subscribe(
          geojson => {
            source.dispatchLoadEvent(le.PartReceived);
            source.addFeature(olFeature(source.titel, geojson));
            if (source.gebruikCache) {
              geojsonStore.writeFeature(source.laagnaam, geojson);
            }
          },
          error => {
            if (source.gebruikCache) {
              kaartLogger.debug("Request niet gelukt, we gaan naar cache " + error);
              geojsonStore
                .getFeaturesByExtent(source.laagnaam, extent)
                .then(geojsons => {
                  kaartLogger.debug(`${geojsons.length} features opgehaald uit cache`);
                  return geojsons.map(geojson => {
                    source.dispatchLoadEvent(le.PartReceived);
                    source.addFeature(olFeature(source.titel, geojson));
                  });
                })
                .then(() => source.dispatchLoadComplete())
                .catch(error => {
                  kaartLogger.error(error);
                  source.dispatchLoadError(error);
                });
            } else {
              kaartLogger.error(error);
              source.dispatchLoadError(error);
            }
          },
          () => {
            source.dispatchLoadComplete();
          }
        );
      },
      strategy: ol.loadingstrategy.bbox
    });
  }

  private composeUrl(extent?: number[]) {
    const params = {
      ...fromNullable(extent).fold({}, v => ({ bbox: v.join(",") })),
      ...this.view.fold({}, v => ({ "with-view": v })),
      ...this.filter.fold({}, f => ({ query: encodeURIComponent(f) }))
    };

    return `${this.url}/api/databases/${this.database}/${this.collection}/query?${Object.keys(params)
      .map(function(key) {
        return key + "=" + params[key];
      })
      .join("&")}`;
  }

  fetchFeatures$(extent: number[]): Observable<GeoJsonLike> {
    return fetchWithTimeout(
      this.composeUrl(extent),
      {
        method: "GET",
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include" // essentieel om ACM Authenticatie cookies mee te sturen
      },
      FETCH_TIMEOUT
    ).pipe(switchMap(response => observableFromResponse$(this.laagnaam, NosqlFsSource.featureDelimiter, response)));
  }

  fetchFeaturesByWkt$(wkt: string): Observable<GeoJsonLike> {
    return fetchWithTimeout(
      this.composeUrl(),
      {
        method: "POST",
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include", // essentieel om ACM Authenticatie cookies mee te sturen
        body: wkt
      },
      FETCH_TIMEOUT
    ).pipe(switchMap(response => observableFromResponse$(this.laagnaam, NosqlFsSource.featureDelimiter, response)));
  }

  private dispatchLoadEvent(evt: le.DataLoadEvent) {
    this.loadEventSubj.next(evt);
  }

  private dispatchLoadComplete() {
    this.dispatchLoadEvent(le.LoadComplete);
  }

  private dispatchLoadError(error: any) {
    this.dispatchLoadEvent(le.LoadError(error.toString()));
  }
}
