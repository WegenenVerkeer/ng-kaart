import { Function1 } from "fp-ts/lib/function";
import * as idb from "idb";
import { forkJoin, from, Observable } from "rxjs";
import { filter, map, mergeAll, mergeMap } from "rxjs/operators";

import { get, getAll, getAllKeys, writeMany } from "./indexeddb";

const dbNaam = "nosql-features";

export interface Geometry {
  readonly bbox: ol.Extent;
  readonly coordinates: number[];
  readonly crs: any;
  readonly type: string;
}

export interface Metadata {
  readonly minx: number;
  readonly miny: number;
  readonly maxx: number;
  readonly maxy: number;
  readonly toegevoegd: Date;
}

export interface GeoJsonLike {
  readonly id: any;
  readonly properties: any;
  readonly geometry: Geometry;
  // index values from bbox
  readonly metadata: Metadata;
}

/**
 * Indexering: 4 indexen op minx, miny, maxx, maxy en intersect nemen?
 */
const openStore = (storename: string): Observable<idb.DB> => {
  return from(
    idb.openDb(dbNaam, 1, upgradeDB => {
      switch (upgradeDB.oldVersion) {
        case 0:
          const store = upgradeDB.createObjectStore(storename, { keyPath: "id" });
          store.createIndex("minx", "metadata.minx", { unique: false });
          store.createIndex("miny", "metadata.miny", { unique: false });
          store.createIndex("maxx", "metadata.maxx", { unique: false });
          store.createIndex("maxy", "metadata.maxy", { unique: false });
      }
    })
  );
};

export const clear: <T>(storename: string) => Observable<void> = <T>(storename: string) => {
  return openStore(storename).pipe(
    mergeMap(db =>
      from(
        db
          .transaction(storename, "readwrite")
          .objectStore<T, any>(storename)
          .clear()
      )
    )
  );
};

export const deleteFeatures = (storename: string, extent: ol.Extent): Observable<number> =>
  forkJoin(
    getLower(storename, "minx", extent[0]),
    getLower(storename, "miny", extent[1]),
    getUpper(storename, "maxx", extent[2]),
    getUpper(storename, "maxy", extent[3])
  ).pipe(
    map(([minXs, minYs, maxXs, maxYs]) => intersect(maxYs, intersect(maxXs, intersect(minXs, minYs)))),
    mergeMap(keys => deleteFeaturesByKeys(storename, keys))
  );

const deleteFeaturesByKeys = (storename: string, keys: any[]): Observable<number> =>
  openStore(storename).pipe(
    mergeMap(db => {
      const tx = db.transaction(storename, "readwrite");
      keys.map(key => tx.objectStore<GeoJsonLike, any>(storename).delete(key));
      return from(tx.complete).pipe(map(() => keys.length));
    })
  );

export const writeFeatures = (storename: string, features: GeoJsonLike[]): Observable<number> =>
  openStore(storename).pipe(mergeMap(db => writeMany<GeoJsonLike>(db, storename, features)));

export const getFeature = (storename: string, id: any): Observable<GeoJsonLike> =>
  openStore(storename).pipe(mergeMap(db => get<GeoJsonLike>(db, storename, id)));

export const getFeatures = (storename: string, filterFunc: Function1<GeoJsonLike, boolean>): Observable<GeoJsonLike[]> =>
  openStore(storename).pipe(mergeMap(db => getAll<GeoJsonLike>(db, storename).pipe(map(features => features.filter(filterFunc)))));

export const getFeaturesByIds = (storename: string, keys: any[]): Observable<GeoJsonLike> =>
  openStore(storename).pipe(mergeMap(db => from(keys.map(key => get<GeoJsonLike>(db, storename, key))).pipe(mergeAll())));

export const getFeaturesByExtent = (storename: string, extent: ol.Extent): Observable<GeoJsonLike> =>
  forkJoin(
    getLower(storename, "minx", extent[0]),
    getLower(storename, "miny", extent[1]),
    getUpper(storename, "maxx", extent[2]),
    getUpper(storename, "maxy", extent[3])
  ).pipe(
    map(([minXs, minYs, maxXs, maxYs]) => intersect(maxYs, intersect(maxXs, intersect(minXs, minYs)))),
    mergeMap(keys => getFeaturesByIds(storename, keys))
  );

export const getFeaturesByExtentTableScan = (storename: string, extent: ol.Extent): Observable<GeoJsonLike[]> => {
  const [minx, miny, maxx, maxy] = extent;
  return getFeatures(
    storename,
    feature =>
      feature.metadata.minx >= minx && feature.metadata.maxx <= maxx && feature.metadata.miny >= miny && feature.metadata.maxy <= maxy
  );
};

const getLower = (storename: string, idx: string, bound: number): Observable<any[]> =>
  openStore(storename).pipe(mergeMap(db => getAllKeys<GeoJsonLike>(db, storename, idx, IDBKeyRange.lowerBound(bound))));

const getUpper = (storename: string, idx: string, bound: number): Observable<any[]> =>
  openStore(storename).pipe(mergeMap(db => getAllKeys<GeoJsonLike>(db, storename, idx, IDBKeyRange.upperBound(bound))));

const intersect = <T>(a: T[], b: T[]) => a.filter(value => -1 !== b.indexOf(value));
