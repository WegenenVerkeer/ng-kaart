import { Function1 } from "fp-ts/lib/function";
import * as idb from "idb";
import { DB } from "idb";
import { forkJoin, from, Observable } from "rxjs";
import { filter, map, mergeAll, mergeMap } from "rxjs/operators";

const indexedb_db_naam = "nosql-features";

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
    idb.openDb(indexedb_db_naam, 1, upgradeDB => {
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

const get = (db: DB, storename: string, key: any): Observable<GeoJsonLike> =>
  from(
    db
      .transaction(storename)
      .objectStore<GeoJsonLike, any>(storename)
      .get(key)
  );

const deleteFeature = (db: DB, storename: string, key: any): Observable<void> =>
  from(
    db
      .transaction(storename)
      .objectStore<GeoJsonLike, any>(storename)
      .delete(key)
  );

const getAll = (db: DB, storename: string): Observable<GeoJsonLike> =>
  from(
    db
      .transaction(storename)
      .objectStore<GeoJsonLike, any>(storename)
      .getAll()
  ).pipe(mergeAll());

export const clear: (storename: string) => Observable<boolean> = (storename: string) =>
  openStore(storename).pipe(
    mergeMap(db =>
      from(
        db
          .transaction(storename, "readwrite")
          .objectStore<GeoJsonLike, any>(storename)
          .clear()
      )
    ),
    map(() => true)
  );

const getAllKeys = (db: DB, storename: string, idx: string, keyRange: IDBKeyRange): Observable<any[]> =>
  from(
    db
      .transaction(storename)
      .objectStore<GeoJsonLike, any>(storename)
      .index(idx)
      .getAllKeys(keyRange)
  );

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
  openStore(storename).pipe(
    mergeMap(db => {
      const tx = db.transaction(storename, "readwrite");
      features.map(feature => tx.objectStore<GeoJsonLike, any>(storename).put(feature));
      return from(tx.complete).pipe(map(() => features.length));
    })
  );

export const getFeature = (storename: string, id: any): Observable<GeoJsonLike> =>
  openStore(storename).pipe(mergeMap(db => get(db, storename, id)));

export const getFeatures = (storename: string, filterFunc: Function1<GeoJsonLike, boolean>): Observable<GeoJsonLike> =>
  openStore(storename).pipe(mergeMap(db => getAll(db, storename).pipe(filter(filterFunc))));

export const getFeaturesByIds = (storename: string, keys: any[]): Observable<GeoJsonLike> =>
  openStore(storename).pipe(mergeMap(db => from(keys.map(key => get(db, storename, key))).pipe(mergeAll())));

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

export const getFeaturesByExtentTableScan = (storename: string, extent: ol.Extent): Observable<GeoJsonLike> => {
  const [minx, miny, maxx, maxy] = extent;
  return getFeatures(
    storename,
    feature =>
      feature.metadata.minx >= minx && feature.metadata.maxx <= maxx && feature.metadata.miny >= miny && feature.metadata.maxy <= maxy
  );
};

const getLower = (storename: string, idx: string, bound: number): Observable<any[]> =>
  openStore(storename).pipe(mergeMap(db => getAllKeys(db, storename, idx, IDBKeyRange.lowerBound(bound))));

const getUpper = (storename: string, idx: string, bound: number): Observable<any[]> =>
  openStore(storename).pipe(mergeMap(db => getAllKeys(db, storename, idx, IDBKeyRange.upperBound(bound))));

const intersect = <T>(a: T[], b: T[]) => a.filter(value => -1 !== b.indexOf(value));
