import { array } from "fp-ts";
import { BinaryOperation, concat, Function1, Function2, Refinement } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as set from "fp-ts/lib/Set";
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
        // Tijdelijk work-around voor fake featureserver die geen bbox genereert.
        // Meer permanent moeten we er rekening mee houden dat bbox niet verplicht is.
        const bbox = fromNullable(geojson.geometry.bbox).getOrElse([0, 0, 0, 0]);
        return {
          ...geojson,
          metadata: {
            minx: bbox[0],
            miny: bbox[1],
            maxx: bbox[2],
            maxy: bbox[3],
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

type FeatureSet = Set<ol.Feature>;

const featureSetUnion: Function2<FeatureSet, FeatureSet, FeatureSet> = set.union(Feature.setoidFeaturePropertyId);

const arrayToFeatureSet: Function1<ol.Feature[], FeatureSet> = set.fromArray(Feature.setoidFeaturePropertyId);

const featureSetDifference: BinaryOperation<FeatureSet, FeatureSet> = set.difference2v(Feature.setoidFeaturePropertyId);

const newFeatures: Function2<FeatureSet, ol.Feature[], FeatureSet> = (features, extraFeatures) =>
  featureSetDifference(arrayToFeatureSet(extraFeatures), features);

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
  const batchedFeatures$ = source.fetchFeatures$(extent, gebruikCache).pipe(
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
  // De `memCachedFeatures` laat toe om te weten welke features al op de kaart staan. Zo vermijden we features
  // metdezelfde id meer dan eens toe te voegen (want dat heeft problemen in OL). In principe kunnen we ook aan OL
  // vragen welke features er op de laag staan, maar dan krijgen we een array terug waar we iets moeilijker kunnen in
  // zoeken. Heel veel extra geheugen hebben we niet nodig gezien we enkel een referentie naar bestaande features
  // opvragen. Een optimalisatie zou kunnen zijn om enkel de id's ipv de hele feature op te slaan. Wbt geheugen maakt
  // dat niet veel uit, maar we kunnen dan de `setoid` overslaan gezien de id een `string` is.
  private memCachedFeatures: FeatureSet = set.empty;

  constructor(
    private readonly database: string,
    private readonly collection: string,
    private readonly url = "/geolatte-nosqlfs",
    private readonly view: Option<string>,
    private readonly filter: Option<string>,
    private readonly laagnaam: string,
    memCacheSize: number,
    gebruikCache: boolean
  ) {
    super({
      loader: function(extent: ol.Extent) {
        const source: NosqlFsSource = this;
        const oldFeatures: ol.Feature[] = this.getFeatures();
        kaartLogger.debug("Aantal features op layer", oldFeatures.length);
        const featuresLoader$: rx.Observable<ol.Feature[]> = (this.offline
          ? featuresFromCache(laagnaam, extent)
          : featuresFromServer(source, laagnaam, gebruikCache, extent)
        ).pipe(
          map(geojsons => geojsons.map(toOlFeature(laagnaam))),
          share()
        );
        const newFeatures$ = featuresLoader$.pipe(map(features => newFeatures(source.memCachedFeatures, features)));
        const allNewFeatures$ = newFeatures$.pipe(reduce(featureSetUnion, set.empty));
        newFeatures$.subscribe({
          next: newFeatures => {
            source.dispatchLoadEvent(le.PartReceived);
            source.addFeatures([...newFeatures.values()]);
          },
          error: error => {
            kaartLogger.error(error);
            source.dispatchLoadError(error);
          }
        });
        allNewFeatures$.subscribe(
          newFeatures => {
            source.dispatchLoadComplete();
            source.memCachedFeatures = featureSetUnion(source.memCachedFeatures, newFeatures);
            kaartLogger.debug("Aantal features in memcache", source.memCachedFeatures.size);
            if (source.memCachedFeatures.size > memCacheSize) {
              const featuresOutsideExtent = set.filter(source.memCachedFeatures, Feature.notInExtent(extent));

              kaartLogger.debug("Te verwijderen", featuresOutsideExtent.size);
              featuresOutsideExtent.forEach(feature => {
                try {
                  this.removeFeature(feature);
                } catch (e) {
                  kaartLogger.error("Probleem tijdens verwijderen van feature", e);
                }
              });
              source.memCachedFeatures = featureSetDifference(source.memCachedFeatures, featuresOutsideExtent);
              kaartLogger.debug("Aantal features in memcache na clear", source.memCachedFeatures.size);
            }
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

  fetchFeatures$(extent: number[], gebruikCache: boolean): rx.Observable<GeoJsonLike> {
    if (gebruikCache) {
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
    return fetchObs$(this.composeUrl(), {
      method: "POST",
      cache: "no-store", // geen client side caching van nosql data
      credentials: "include", // essentieel om ACM Authenticatie cookies mee te sturen
      body: wkt
    }).pipe(
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
