import { array } from "fp-ts";
import { concat, Function1, not, Refinement } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { setoidNumber, setoidString } from "fp-ts/lib/Setoid";
import * as rx from "rxjs";
import {
  bufferCount,
  catchError,
  filter,
  map,
  mapTo,
  mergeMap,
  reduce,
  scan,
  share,
  startWith,
  switchMap,
  takeLast,
  takeWhile,
  tap
} from "rxjs/operators";

import { FilterCql } from "../filter/filter-cql";
import { Filter as fltr } from "../filter/filter-model";
import {
  FilterTotaal,
  isTotaalTerminaal,
  teVeelData,
  totaalOpgehaald,
  totaalOphalenMislukt,
  totaalOpTeHalen
} from "../filter/filter-totaal";
import * as le from "../kaart/kaart-load-events";
import { kaartLogger } from "../kaart/log";
import * as arrays from "../util/arrays";
import { Feature, toOlFeature } from "../util/feature";
import { fetchObs$, fetchWithTimeoutObs$ } from "../util/fetch-with-timeout";
import { ReduceFunction } from "../util/function";
import { CollectionSummary, FeatureCollection, GeoJsonLike } from "../util/geojson-types";
import * as geojsonStore from "../util/indexeddb-geojson-store";
import * as ol from "../util/openlayers-compat";
import { Pipeable } from "../util/operators";
import { forEach } from "../util/option";

import { Extent } from "./extent";

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

export const featureDelimiter = "\n";

export type Params = Record<string, string | number>;

namespace Params {
  export const toQueryString = (params: Params): string =>
    Object.keys(params)
      .map(key => key + "=" + params[key])
      .join("&");
}

export interface PagingSpec {
  readonly start: number;
  readonly count: number;
  readonly sortFields: string[];
  readonly sortDirections: PagingSpec.SortDirection[];
}

export namespace PagingSpec {
  export type SortDirection = "ASC" | "DESC";
  export const toQueryParams = (spec: PagingSpec) => {
    const [sort, sortDirection] = array.unzip(array.zip(spec.sortFields, spec.sortDirections));
    if (arrays.isNonEmpty(sort)) {
      return {
        start: spec.start,
        limit: spec.count,
        sort,
        "sort-direction": sortDirection
      };
    } else {
      return {
        start: spec.start,
        limit: spec.count
      };
    }
  };
}

const cacheCredentials: () => RequestInit = () => ({
  cache: "no-store", // geen client side caching van nosql data
  credentials: "include" // essentieel om ACM Authenticatie cookies mee te sturen
});

export const getWithoutHeaders: () => RequestInit = () => ({
  method: "GET"
});

export const getWithCommonHeaders: () => RequestInit = () => ({
  ...cacheCredentials(),
  method: "GET"
});

const postWithoutHeaders: (_: string) => RequestInit = body => ({
  method: "POST",
  body: body
});

const postWithCommonHeaders: (_: string) => RequestInit = body => ({
  ...cacheCredentials(),
  method: "POST",
  body: body
});

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

export const split: Function1<string, Pipeable<string, string>> = delimiter => obs => {
  const splitterState$: rx.Observable<SplitterState> = obs.pipe(
    scan(splitter(delimiter), { seen: "", output: [] }),
    share()
  );
  return rx.merge(
    splitterState$.pipe(mergeMap(s => rx.from(s.output))),
    splitterState$.pipe(
      // we mogen de laatste output niet verliezen
      takeLast(1), // takeLast kan er mee overweg dat er evt geen data is
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

export const mapToFeatureCollection: Pipeable<string, FeatureCollection> = obs =>
  obs.pipe(
    map(lijn => {
      try {
        return JSON.parse(lijn) as FeatureCollection;
      } catch (error) {
        const msg = `Kan JSON data niet parsen: ${error} JSON: ${lijn}`;
        kaartLogger.error(msg);
        throw new Error(msg);
      }
    })
  );

const mapToCollectionSummary: Pipeable<string, CollectionSummary> = obs =>
  obs.pipe(
    map(lijn => {
      try {
        return JSON.parse(lijn) as CollectionSummary;
      } catch (error) {
        const msg = `Kan JSON data niet parsen: ${error} JSON: ${lijn}`;
        kaartLogger.error(msg);
        throw new Error(msg);
      }
    })
  );

function featuresFromCache(laagnaam: string, extent: Extent): rx.Observable<GeoJsonLike[]> {
  return geojsonStore.getFeaturesByExtent(laagnaam, extent).pipe(
    bufferCount(BATCH_SIZE),
    tap(geojsons => kaartLogger.debug(`${geojsons.length} features opgehaald uit cache`))
  );
}

function featuresFromServer(
  source: NosqlFsSource,
  laagnaam: string,
  gebruikCache: boolean,
  extent: Extent,
  prevExtent: Extent
): rx.Observable<GeoJsonLike[]> {
  const toFetch = Extent.difference(extent, prevExtent);
  const batchedFeatures$ = rx.merge(
    ...toFetch.map(ext =>
      source.fetchFeatures$(source.composeQueryUrl(some(ext), none), gebruikCache).pipe(
        bufferCount(BATCH_SIZE),
        catchError(error => {
          // Volgende keer moeten we proberen alles weer op te halen,
          // anders gaan we gaten krijgen omdat we door onze optimalisatie denken dat de features binnen prevExtent al
          // correct opgehaald zijn, wat niet noodzakelijk waar is.
          // Dit is een fix voor CK-205.
          source.clearPrevExtent();
          return gebruikCache ? featuresFromCache(laagnaam, extent) : rx.throwError(error);
        })
      )
    )
  );
  const cacheWriter$ = gebruikCache
    ? batchedFeatures$.pipe(
        reduce<GeoJsonLike[], GeoJsonLike[]>(concat, []), // alles in  1 grote array steken
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
    : rx.EMPTY;
  return rx.merge(batchedFeatures$, cacheWriter$);
}
// Instanceof blijkt niet betrouwbaar te zijn
export const isNoSqlFsSource: Refinement<ol.source.Vector, NosqlFsSource> = (vector): vector is NosqlFsSource =>
  vector.hasOwnProperty("loadEvent$");

export class NosqlFsSource extends ol.source.Vector {
  private readonly loadEventSubj = new rx.Subject<le.DataLoadEvent>();
  readonly loadEvent$: rx.Observable<le.DataLoadEvent> = this.loadEventSubj;
  private offline = false;
  private busyCount = 0;
  private outstandingRequestExtents: Extent[] = []; // De extents die opgevraagd zijn en nog niet ontvangen op een moment van rust
  private prevExtent: Extent = [0, 0, 0, 0]; // De vorig opgegevraagde extent
  private outstandingQueries: string[] = [];
  private userFilter: Option<string> = none; // Een arbitraire filter bovenop de basisfilter
  private userFilterActive = false;

  private filterSubj: rx.Subject<string> = new rx.BehaviorSubject("1 = 1");

  constructor(
    private readonly database: string,
    private readonly collection: string,
    private readonly url = "/geolatte-nosqlfs",
    private readonly view: Option<string>,
    private readonly baseFilter: Option<string>, // De basisfilter voor de data (bijv. voor EM-installaties)
    private readonly laagnaam: string,
    readonly memCacheSize: number,
    readonly gebruikCache: boolean,
    readonly cors: boolean = false
  ) {
    super({
      loader: function(extent: Extent) {
        const source: NosqlFsSource = this as NosqlFsSource;
        source.busyCount += 1;
        source.outstandingRequestExtents = array.snoc(source.outstandingRequestExtents, extent);
        const queryUrlVoorExtent = source.composeQueryUrl(some(extent), none);
        source.outstandingQueries = array.snoc(source.outstandingQueries, queryUrlVoorExtent);
        const featuresLoader$: rx.Observable<ol.Feature[]> = (source.offline
          ? featuresFromCache(laagnaam, extent)
          : featuresFromServer(source, laagnaam, gebruikCache, extent, source.prevExtent)
        ).pipe(
          map(geojsons => geojsons.map(toOlFeature(laagnaam))),
          share()
        );
        source.prevExtent = extent;
        const newFeatures$ = featuresLoader$.pipe(map(features => features));
        newFeatures$.subscribe({
          next: newFeatures => {
            source.dispatchLoadEvent(le.PartReceived);
            // Als we ondertussen op een ander stuk van de kaart aan het kijken zijn, dan hoeven we de features van een
            // oude request niet meer toe te voegen
            // Zelfde met filter: als de filter is gewijzigd, dan zijn wij niet meer geïnteresseerd in de oude waarden
            if (
              array.last(source.outstandingRequestExtents).contains(array.getSetoid(setoidNumber), extent) ||
              array.last(source.outstandingQueries).contains(setoidString, queryUrlVoorExtent)
            ) {
              source.addFeatures([...newFeatures.values()]);
            }
          },
          error: error => {
            kaartLogger.error(error);
            source.dispatchLoadError(error);
            source.busyCount -= 1;
          },
          complete: () => {
            source.busyCount -= 1;
            source.dispatchLoadComplete();
            // We mogen memCachedFeatures enkel in de "critische sectie" aanpassen.
            const allFeatures = source.getFeatures();
            kaartLogger.debug("Aantal features in memcache", allFeatures.length);
            // De busyCount zorgt er voor dat we de features op de kaart niet aanpassen terwijl er nog nieuwe aan het
            // binnen komen zijn. Wat we daarmee niet opvangen is de mogelijkheid dat we de verkeerde extent aan het
            // behouden zijn. Het kan immers gebeuren dat een fetch van een extent waar we eerder waren later binnen
            // komt. De volgorde van de resultaten is immers niet gegarandeerd. Wanneer dat gebeurt, verwijderen we de
            // features op het zichtbare gedeelte van de kaart. Daarom gebruiken we de recentste extent zoals gezet bij
            // de start van de loader (dat gebeurt wel in de goede volgorde) en gebruiken we die extent om features van
            // te behouden.
            if (allFeatures.length > memCacheSize && source.busyCount === 0) {
              const featuresOutsideExtent = array
                .last(source.outstandingRequestExtents)
                .fold([], lastExtent => array.filter(allFeatures, Feature.notInExtent(lastExtent)));

              kaartLogger.debug("Te verwijderen", featuresOutsideExtent.length);
              try {
                featuresOutsideExtent.forEach(feature => source.removeFeature(feature));
              } catch (e) {
                kaartLogger.error("Probleem tijdens verwijderen van features", e);
              }
              kaartLogger.debug("Aantal features in memcache na clear", source.getFeatures().length);
              // Af en toe kuisen we de outstanding requests op. Tussentijds is lastig omdat het mogelijk is dat
              // dezelfde extent meer dan eens in de array zit.
              if (source.busyCount === 0) {
                source.outstandingRequestExtents = [];
                source.outstandingQueries = [];
              }
            }
          }
        });
      },
      strategy: ol.loadingstrategy.bbox
    });
  }

  private viewAndFilterParams(respectUserFilterActivity = true) {
    return {
      ...this.view.fold<any>({}, v => ({ "with-view": encodeURIComponent(v) })),
      ...this.composedFilter(respectUserFilterActivity).fold<any>({}, f => ({ query: encodeURIComponent(f) }))
    };
  }

  composeQueryUrl(extent: Option<number[]>, pagingSpec: Option<PagingSpec>) {
    const params = {
      ...extent.map(Extent.toQueryValue).fold<any>({}, bbox => ({ bbox })),
      ...pagingSpec.map<any>(PagingSpec.toQueryParams).getOrElse({}),
      ...this.viewAndFilterParams()
    };

    return `${this.url}/api/databases/${this.database}/${this.collection}/query?${Params.toQueryString(params)}`;
  }

  composeCsvExportUrl(
    extent: Option<number[]>,
    filename: string,
    fields: string[],
    sortFields: string[],
    sortDirections: PagingSpec.SortDirection[],
    overruleFilter: Option<string>
  ) {
    const params = {
      projection: fields.join(","),
      fmt: "csv",
      sep: "%3B",
      filename: filename,
      sort: sortFields.join(","),
      "sort-direction": sortDirections.join(","),
      ...extent.map(Extent.toQueryValue).fold<any>({}, bbox => ({ bbox })),
      ...overruleFilter.alt(this.composedFilter(true)).fold<any>({}, f => ({ query: encodeURIComponent(f) }))
    };

    return `${this.url}/api/databases/${this.database}/${this.collection}/query?${Params.toQueryString(params)}`;
  }

  private composeFeatureCollectionUrl(params: Record<string, string | number>) {
    return `${this.url}/api/databases/${this.database}/${this.collection}/featurecollection?${Params.toQueryString(params)}`;
  }

  private composeFeatureCollectionTotalUrl() {
    return this.composeFeatureCollectionUrl({
      limit: 1,
      ...this.viewAndFilterParams(false)
    });
  }

  private composeFeatureCollectionWithFilteredTotalUrl(pagingSpec: PagingSpec) {
    return this.composeFeatureCollectionUrl({
      ...PagingSpec.toQueryParams(pagingSpec),
      ...this.viewAndFilterParams(true)
    });
  }

  public composedFilter(respectUserFilterActivity: boolean): Option<string> {
    const userFilter = this.applicableUserFilter(respectUserFilterActivity);
    return this.baseFilter.foldL(
      () => userFilter, //
      basisFilter => userFilter.map(extraFilter => `(${basisFilter}) AND (${extraFilter})`).alt(this.baseFilter)
    );
  }

  private applicableUserFilter(respectUserFilterActivity: boolean): Option<string> {
    return this.userFilter.filter(() => !respectUserFilterActivity || this.userFilterActive);
  }

  private composeCollectionSummaryUrl() {
    return `${this.url}/api/databases/${this.database}/${this.collection}`;
  }

  cacheStoreName(): string {
    return this.laagnaam;
  }

  fetchFeatures$(composedQueryUrl: string, gebruikCache: boolean): rx.Observable<GeoJsonLike> {
    if (gebruikCache) {
      return fetchWithTimeoutObs$(composedQueryUrl, this.cors ? getWithoutHeaders() : getWithCommonHeaders(), FETCH_TIMEOUT).pipe(
        split(featureDelimiter),
        filter(lijn => lijn.trim().length > 0),
        mapToGeoJson
      );
    } else {
      return fetchObs$(composedQueryUrl, this.cors ? getWithoutHeaders() : getWithCommonHeaders()).pipe(
        split(featureDelimiter),
        filter(lijn => lijn.trim().length > 0),
        mapToGeoJson
      );
    }
  }

  fetchFeaturesByWkt$(wkt: string): rx.Observable<GeoJsonLike> {
    return fetchObs$(this.composeQueryUrl(none, none), this.cors ? postWithoutHeaders(wkt) : postWithCommonHeaders(wkt)).pipe(
      split(featureDelimiter),
      filter(lijn => lijn.trim().length > 0),
      mapToGeoJson
    );
  }

  fetchTotal$(): rx.Observable<FilterTotaal> {
    return this.fetchCollectionSummary$().pipe(
      switchMap(summary =>
        summary.count > 100000
          ? rx.of(teVeelData(summary.count))
          : this.filterSubj.pipe(
              switchMap(() =>
                fetchObs$(this.composeFeatureCollectionTotalUrl(), this.cors ? getWithoutHeaders() : getWithCommonHeaders()).pipe(
                  split(featureDelimiter),
                  mapToFeatureCollection,
                  map(featureCollection => featureCollection.total),
                  map(totaalOpgehaald(summary.count)),
                  startWith(totaalOpTeHalen())
                )
              )
            )
      ),
      catchError(err => rx.of(totaalOphalenMislukt(err))),
      takeWhile(not(isTotaalTerminaal), true)
    );
  }

  fetchFeatureCollection$(pagingSpec: PagingSpec): rx.Observable<FeatureCollection> {
    return fetchObs$(
      this.composeFeatureCollectionWithFilteredTotalUrl(pagingSpec),
      this.cors ? getWithoutHeaders() : getWithCommonHeaders()
    ).pipe(
      split(featureDelimiter), // Eigenlijk 1 lange lijn
      mapToFeatureCollection
    );
  }

  private fetchCollectionSummary$(): rx.Observable<CollectionSummary> {
    return fetchObs$(this.composeCollectionSummaryUrl(), this.cors ? getWithoutHeaders() : getWithCommonHeaders()).pipe(
      split(featureDelimiter), // Eigenlijk alles op 1 lijn
      mapToCollectionSummary
    );
  }

  setOffline(offline: boolean) {
    this.offline = offline;
  }

  setUserFilter(cqlFilter: fltr.Filter, filterActive: boolean) {
    const maybeCql = FilterCql.cql(cqlFilter);
    this.userFilter = maybeCql;
    this.userFilterActive = filterActive;
    this.clearPrevExtent(); // Ook de data voor de huidige viewport moet weer opgevraagd worden
    this.clear();
    this.refresh();
    forEach(maybeCql, cql => this.filterSubj.next(cql));
  }

  getUserFilter(): Option<string> {
    return this.userFilter;
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

  clearPrevExtent() {
    this.prevExtent = [0, 0, 0, 0];
  }

  clear(opt_fast?: boolean): void {
    super.clear(opt_fast);
    this.clearPrevExtent();
  }
}
