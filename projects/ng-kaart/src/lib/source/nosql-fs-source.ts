import { array } from "fp-ts";
import { concat, Function1, Refinement } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { bufferCount, catchError, filter, last, map, mapTo, mergeMap, reduce, scan, share, switchMap, tap } from "rxjs/operators";

import * as le from "../kaart/kaart-load-events";
import { kaartLogger } from "../kaart/log";
import { Pipeable } from "../util";
import { Feature, toOlFeature } from "../util/feature";
import { fetchObs$, fetchWithTimeoutObs$ } from "../util/fetch-with-timeout";
import { ReduceFunction } from "../util/function";
import { GeoJsonLike } from "../util/geojson-types";
import * as geojsonStore from "../util/indexeddb-geojson-store";

/**
 * Stappen:

 1. Er komt een extent binnen van de kaart om de features op te vragen
 2. NosqlfsLoader gaat de features voor die extent opvragen aan featureserver
 3. Bij ontvangen van de features worden deze bewaard in een indexeddb (1 per laag), gemanaged door ng-kaart. Moeten bestaande niet eerst
 verwijderd worden?
 4. Indien NosqlfsLoader binnen 5 seconden geen antwoord heeft gekregen, worden eventueel bestaande features binnen de extent uit
 de indexeddb gehaald

 */

const FETCH_TIMEOUT = 5000; // max time to wait for data from featureserver before checking cache, enkel indien gebruikCache = true
const BATCH_SIZE = 100; // aantal features per keer toevoegen aan laag

const featureDelimiter = "\n";

interface SplitterState {
  readonly seen: string;
  readonly output: string[];
}

const splitter: Function1<string, ReduceFunction<SplitterState, string>> = delimiter => (state, line) => {
  const allData = state.seen + line; // neem de gegevens mee die de vorige keer niet verwerkt zijn
  const parts = allData.split(delimiter);
  // foldr doet niks meer dan het laatste element van de array nemen ermee rekenening houdende dat de array leeg kan zijn
  return array.foldr(
    parts,
    { seen: "", output: [] }, // als er niks was, dan ook geen output (enkel als allData en delimiter leeg zijn)
    (init, last) => ({ seen: last, output: init }) // steek alle volledig stukken en output en onthoudt de overschot in seen
  );
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

const mapToGeoJson: Pipeable<string, GeoJsonLike> = obs =>
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
            toegevoegd: new Date().toISOString()
          }
        };
      } catch (error) {
        const msg = `Kan JSON data niet parsen: ${error} JSON: ${lijn}`;
        kaartLogger.error(msg);
        throw new Error(msg);
      }
    })
  );

function featuresFromCache(laagnaam: string, extent: ol.Extent): rx.Observable<GeoJsonLike[]> {
  return geojsonStore.getFeaturesByExtent(laagnaam, extent).pipe(
    bufferCount(BATCH_SIZE),
    tap(geojsons => kaartLogger.debug(`${geojsons.length} features opgehaald uit cache`))
  );
}

function featuresFromServer(
  source: NosqlFsSource,
  laagnaam: string,
  gebruikCache: boolean,
  extent: ol.Extent
): rx.Observable<GeoJsonLike[]> {
  const batchedFeatures$ = source.fetchFeatures$(extent).pipe(
    bufferCount(BATCH_SIZE),
    catchError(error => (gebruikCache ? featuresFromCache(laagnaam, extent) : rx.throwError(error)))
  );
  const cacheWriter$ = gebruikCache
    ? batchedFeatures$.pipe(
        reduce(concat, []), // alles in  1 grote array steken
        switchMap(allFeatures =>
          // dan de oude gecachte features in de extent verwijderen
          geojsonStore.deleteFeatures(laagnaam, extent).pipe(
            tap(aantal => kaartLogger.info(`${aantal} features verwijderd uit cache`)),
            switchMap(() =>
              // en tenslotte de net ontvangen features in de cache steken
              geojsonStore.writeFeatures(laagnaam, allFeatures).pipe(
                tap(aantal => kaartLogger.info(`${aantal} features weggeschreven in cache`)),
                mapTo([])
              )
            )
          )
        )
      )
    : rx.empty();
  return rx.merge(batchedFeatures$, cacheWriter$);
}
// Instanceof blijkt niet betrouwbaar te zijn
export const isNoSqlFsSource: Refinement<ol.source.Vector, NosqlFsSource> = (vector): vector is NosqlFsSource =>
  vector.hasOwnProperty("loadEvent$");

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
      loader: function(extent: ol.Extent) {
        const source: NosqlFsSource = this;
        const oldFeatures: ol.Feature[] = this.getFeatures();
        const featuresLoader$: rx.Observable<ol.Feature[]> = (this.offline
          ? featuresFromCache(laagnaam, extent)
          : featuresFromServer(source, laagnaam, gebruikCache, extent)
        ).pipe(
          map(geojsons => geojsons.map(toOlFeature(laagnaam))),
          share()
        );
        const allFeatures$ = featuresLoader$.pipe(reduce(concat, []));
        featuresLoader$.subscribe({
          next: features => {
            source.dispatchLoadEvent(le.PartReceived);
            source.addFeatures(features);
          },
          error: error => {
            kaartLogger.error(error);
            source.dispatchLoadError(error);
          }
        });
        allFeatures$.subscribe(
          newFeatures => {
            source.dispatchLoadComplete();
            const notFetchedFeatures = array.difference(Feature.setoidFeaturePropertyId)(oldFeatures, newFeatures);
            console.log("***Huidig aantal features", newFeatures.length);
            console.log("***Vorig aantal features", oldFeatures.length);
            console.log("***Te verwijderen", notFetchedFeatures.length);
            notFetchedFeatures.forEach(feature => {
              try {
                this.removeFeature(feature);
              } catch (e) {
                console.error("****", e);
              }
            });
            console.log("***Na forEach", notFetchedFeatures);
          },
          () => {} // we hebben de errors al afgehandeld
        );
      },
      strategy: ol.loadingstrategy.bbox
    });
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

  cacheStoreName(): string {
    return this.laagnaam;
  }

  fetchFeatures$(extent: number[]): rx.Observable<GeoJsonLike> {
    if (this.gebruikCache) {
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
        filter(lijn => lijn.trim().length > 0),
        mapToGeoJson
      );
    } else {
      return fetchObs$(this.composeUrl(extent), {
        method: "GET",
        cache: "no-store", // geen client side caching van nosql data
        credentials: "include" // essentieel om ACM Authenticatie cookies mee te sturen
      }).pipe(
        split(featureDelimiter),
        filter(lijn => lijn.trim().length > 0),
        mapToGeoJson
      );
    }
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
      filter(lijn => lijn.trim().length > 0),
      mapToGeoJson
    );
  }

  setOffline(offline: boolean) {
    this.offline = offline;
  }

  dispatchLoadEvent(evt: le.DataLoadEvent) {
    this.loadEventSubj.next(evt);
  }

  dispatchLoadComplete() {
    this.dispatchLoadEvent(le.LoadComplete);
  }

  dispatchLoadError(error: any) {
    this.dispatchLoadEvent(le.LoadError(error.toString()));
  }
}
