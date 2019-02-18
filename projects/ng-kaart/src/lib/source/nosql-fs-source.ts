import { Function1, Function2, Function3, Function4 } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { bufferCount, switchMap } from "rxjs/operators";

import * as le from "../kaart/kaart-load-events";
import { kaartLogger } from "../kaart/log";
import { fetchWithTimeout } from "../util/fetch-with-timeout";
import * as geojsonStore from "../util/geojson-store";
import { GeoJsonLike } from "../util/geojson-store";

const FETCH_TIMEOUT = 5000; // max time to wait for data from featureserver before checking cache
const BATCH_SIZE = 100; // aantal features per keer toevoegen aan laag

const format = new ol.format.GeoJSON();
const decoder = new TextDecoder();
const featureDelimiter = "\n";

/**
 * Stappen:

 1. Er komt een extent binnen van de kaart om de features op te vragen
 2. NosqlfsLoader gaat de features voor die extent opvragen aan featureserver
 3. Bij ontvangen van de features worden deze bewaard in een indexeddb (1 per laag), gemanaged door ng-kaart. Moeten bestaande niet eerst
    verwijderd worden?
 4. Indien NosqlfsLoader binnen 5 seconden geen antwoord heeft gekregen, worden eventueel bestaande features binnen de extent uit
    de indexeddb gehaald

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

const toOlFeature: Function2<string, GeoJsonLike, ol.Feature> = (laagnaam, geojson) =>
  new ol.Feature({
    id: geojson.id,
    properties: geojson.properties,
    geometry: format.readGeometry(geojson.geometry),
    laagnaam: laagnaam
  });

interface ResponseResult {
  value: Uint8Array;
  done: boolean;
}

const verwerkChunk: Function4<ResponseResult, string, rx.Subscriber<GeoJsonLike>, () => rx.Observable<ResponseResult>, void> = (
  responseResult,
  restData,
  subscriber,
  getNextResponseObs$
) => {
  const nieuweData =
    restData +
    decoder.decode(responseResult.value || new Uint8Array(0), {
      stream: !responseResult.done
    }); // append nieuwe data (in geval er een half ontvangen lijn is van vorige call)

  const ontvangenLijnen = nieuweData.split(featureDelimiter);

  if (!responseResult.done) {
    // laatste lijn is vermoedelijk niet compleet. Hou bij voor volgende keer
    const newRestData = ontvangenLijnen[ontvangenLijnen.length - 1];

    // parse alle lijnen behalve de laatste (vermoedelijk gedeeltelijke lijn)
    geoJsons(ontvangenLijnen.slice(0, -1)).map(geojson => subscriber.next(geojson));

    // andere data ophalen
    getNextResponseObs$().subscribe(
      response => verwerkChunk(response, newRestData, subscriber, getNextResponseObs$),
      error => subscriber.error(error)
    );
  } else {
    // alle data werd ontvangen, stuur laatste features door
    geoJsons(ontvangenLijnen).map(geojson => subscriber.next(geojson));
    subscriber.complete();
  }
};

const getReaderResponseObs$: Function1<ReadableStreamReader, rx.Observable<ResponseResult>> = reader =>
  rx.from<ResponseResult>(reader.read());

const getReceivedFeaturesObs$: Function3<string, string, Response, rx.Observable<GeoJsonLike>> = (
  collection,
  featureDelimiter,
  response
) => {
  return rx.Observable.create((subscriber: rx.Subscriber<GeoJsonLike>) => {
    if (!response.ok) {
      subscriber.error(`Probleem bij ontvangen nosql ${collection} data: status ${response.status} ${response.statusText}`);
      return;
    }

    if (!response.body) {
      subscriber.error(`Probleem bij ontvangen nosql ${collection} data: response.body is leeg`);
      return;
    }

    const reader = response.body.getReader();
    getReaderResponseObs$(reader).subscribe(
      response => verwerkChunk(response, "", subscriber, () => getReaderResponseObs$(reader)), //
      error => subscriber.error(error)
    );
  });
};

export class NosqlFsSource extends ol.source.Vector {
  private readonly loadEventSubj = new rx.Subject<le.DataLoadEvent>();
  readonly loadEvent$: rx.Observable<le.DataLoadEvent> = this.loadEventSubj;
  private offline = false;

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
        if (source.offline) {
          source.featuresFromCache(source, extent);
        } else {
          source.featuresFromServer(source, extent);
        }
      },
      strategy: ol.loadingstrategy.bbox
    });
  }

  private featuresFromServer(source, extent) {
    source.dispatchLoadEvent(le.LoadStart);
    source
      .fetchFeatures$(extent)
      .pipe(bufferCount(BATCH_SIZE))
      .subscribe(
        geojsons => {
          source.dispatchLoadEvent(le.PartReceived);
          source.addFeatures(geojsons.map(geojson => toOlFeature(source.titel, geojson)));
          if (source.gebruikCache) {
            geojsonStore.writeFeatures(source.laagnaam, geojsons);
          }
        },
        error => {
          if (source.gebruikCache) {
            // fallback to cache
            kaartLogger.debug("Request niet gelukt, we gaan naar cache " + error);
            source.featuresFromCache(source, extent);
          } else {
            kaartLogger.error(error);
            source.dispatchLoadError(error);
          }
        },
        () => {
          source.dispatchLoadComplete();
        }
      );
  }

  private featuresFromCache(source, extent) {
    source.dispatchLoadEvent(le.LoadStart);
    geojsonStore
      .getFeaturesByExtent(source.laagnaam, extent)
      .pipe(bufferCount(BATCH_SIZE))
      .subscribe(
        geojsons => {
          kaartLogger.debug(`${geojsons.length} features opgehaald uit cache`);
          source.dispatchLoadEvent(le.PartReceived);
          source.addFeatures(geojsons.map(geojson => toOlFeature(source.titel, geojson)));
        },
        error => {
          kaartLogger.error(error);
          source.dispatchLoadError(error);
        },
        () => source.dispatchLoadComplete()
      );
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

  fetchFeatures$(extent: number[]): rx.Observable<GeoJsonLike> {
    return fetchWithTimeout(
      this.composeUrl(extent),
      {
        method: "GET",
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include" // essentieel om ACM Authenticatie cookies mee te sturen
      },
      FETCH_TIMEOUT
    ).pipe(switchMap(response => getReceivedFeaturesObs$(this.laagnaam, featureDelimiter, response)));
  }

  fetchFeaturesByWkt$(wkt: string): rx.Observable<GeoJsonLike> {
    return fetchWithTimeout(
      this.composeUrl(),
      {
        method: "POST",
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include", // essentieel om ACM Authenticatie cookies mee te sturen
        body: wkt
      },
      FETCH_TIMEOUT
    ).pipe(switchMap(response => getReceivedFeaturesObs$(this.laagnaam, featureDelimiter, response)));
  }

  setOffline(offline: boolean) {
    this.offline = offline;
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
