import { array } from "fp-ts";
import { Function1, Function2 } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { bufferCount, filter, last, map, mergeMap, reduce, scan, share, tap } from "rxjs/operators";

import * as le from "../kaart/kaart-load-events";
import { kaartLogger } from "../kaart/log";
import { Pipeable } from "../util";
import { fetchWithTimeoutObs$ } from "../util/fetch-with-timeout";
import { ReduceFunction } from "../util/function";
import * as geojsonStore from "../util/geojson-store";
import { GeoJsonLike } from "../util/geojson-store";

/**
 * Stappen:

 1. Er komt een extent binnen van de kaart om de features op te vragen
 2. NosqlfsLoader gaat de features voor die extent opvragen aan featureserver
 3. Bij ontvangen van de features worden deze bewaard in een indexeddb (1 per laag), gemanaged door ng-kaart. Moeten bestaande niet eerst
 verwijderd worden?
 4. Indien NosqlfsLoader binnen 5 seconden geen antwoord heeft gekregen, worden eventueel bestaande features binnen de extent uit
 de indexeddb gehaald

 */

const FETCH_TIMEOUT = 5000; // max time to wait for data from featureserver before checking cache
const BATCH_SIZE = 100; // aantal features per keer toevoegen aan laag

const format = new ol.format.GeoJSON();

const featureDelimiter = "\n";

interface SplitterState {
  readonly seen: string;
  readonly output: string[];
}

const splitter: Function1<string, ReduceFunction<SplitterState, string>> = delimiter => (state, line) => {
  const allData = state.seen + line;
  const parts = allData.split(delimiter);
  // foldr doet niks meer dan het laatste element van de array nemen en houdt er ok rekening mee dat de array leeg kan zijn
  return array.foldr(parts, { seen: "", output: [] }, (init, last) => ({ seen: last, output: init }));
};

const split: Function1<string, Pipeable<string, string>> = delimiter => obs => {
  const splitterState$: rx.Observable<SplitterState> = obs.pipe(
    scan(splitter(delimiter), { seen: "", output: [] }),
    share()
  );
  return rx.merge(
    splitterState$.pipe(mergeMap(s => rx.from(s.output))),
    splitterState$.pipe(
      // we mogen de laatste output niet verliezen
      last(),
      filter(s => s.seen.length > 0),
      map(s => s.seen)
    )
  );
};

const toGeoJson: Pipeable<string, GeoJsonLike> = obs =>
  obs.pipe(
    map(lijn => {
      try {
        const geojson = JSON.parse(lijn) as GeoJsonLike;
        return {
          ...geojson,
          metadata: {
            minx: geojson.geometry.bbox[0],
            miny: geojson.geometry.bbox[1],
            maxx: geojson.geometry.bbox[2],
            maxy: geojson.geometry.bbox[3],
            toegevoegd: new Date()
          }
        };
      } catch (error) {
        const msg = `Kan JSON data niet parsen: ${error} JSON: ${lijn}`;
        kaartLogger.error(msg);
        throw new Error(msg);
      }
    })
  );

const toOlFeature: Function2<string, GeoJsonLike, ol.Feature> = (laagnaam, geojson) => {
  try {
    return new ol.Feature({
      id: geojson.id,
      properties: geojson.properties,
      geometry: format.readGeometry(geojson.geometry),
      laagnaam: laagnaam
    });
  } catch (error) {
    const msg = `Kan geometry niet parsen: ${error}`;
    kaartLogger.error(msg);
    throw new Error(msg);
  }
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

    const fetchFeaturesObs$ = source.fetchFeatures$(extent);

    // voeg de features toe aan de kaart
    fetchFeaturesObs$.pipe(bufferCount(BATCH_SIZE)).subscribe(
      geojsons => {
        source.dispatchLoadEvent(le.PartReceived);
        source.addFeatures(geojsons.map(geojson => toOlFeature(source.laagnaam, geojson)));
      },
      error => {
        if (source.gebruikCache) {
          // fallback to cache
          kaartLogger.info("Request niet gelukt, we gaan naar cache " + error);
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

    // vervang de oude features in cache door de nieuwe ontvangen features
    if (source.gebruikCache) {
      fetchFeaturesObs$.pipe(reduce((acc, val) => acc.concat(val), [])).subscribe(geojsons => {
        geojsonStore
          .deleteFeatures(source.laagnaam, extent)
          .pipe(
            tap(aantal => kaartLogger.info(`${aantal} features verwijderd uit cache`)),
            mergeMap(() => geojsonStore.writeFeatures(source.laagnaam, geojsons))
          )
          .subscribe(aantal => kaartLogger.info(`${aantal} features weggeschreven in cache`));
      });
    }
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
          source.addFeatures(geojsons.map(geojson => toOlFeature(source.laagnaam, geojson)));
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
      ...this.view.fold({}, v => ({ "with-view": encodeURIComponent(v) })),
      ...this.filter.fold({}, f => ({ query: encodeURIComponent(f) }))
    };

    return `${this.url}/api/databases/${this.database}/${this.collection}/query?${Object.keys(params)
      .map(function(key) {
        return key + "=" + params[key];
      })
      .join("&")}`;
  }

  fetchFeatures$(extent: number[]): rx.Observable<GeoJsonLike> {
    return fetchWithTimeoutObs$(
      this.composeUrl(extent),
      {
        method: "GET",
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include" // essentieel om ACM Authenticatie cookies mee te sturen
      },
      FETCH_TIMEOUT
    ).pipe(
      split(featureDelimiter),
      toGeoJson
    );
  }

  fetchFeaturesByWkt$(wkt: string): rx.Observable<GeoJsonLike> {
    return fetchWithTimeoutObs$(
      this.composeUrl(),
      {
        method: "POST",
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include", // essentieel om ACM Authenticatie cookies mee te sturen
        body: wkt
      },
      FETCH_TIMEOUT
    ).pipe(
      split(featureDelimiter),
      toGeoJson
    );
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
