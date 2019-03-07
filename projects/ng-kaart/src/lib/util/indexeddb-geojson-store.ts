import { Predicate } from "fp-ts/lib/function";
import * as idb from "idb";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map, mapTo, mergeAll, switchMap } from "rxjs/operators";

import { unsafeGet, unsafeGetAll, unsafeGetAllKeys, writeMany } from "./indexeddb";

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
  readonly toegevoegd: string; // De ISO string voorstelling van de datum van toevoeging
}

export interface GeoJsonLike {
  readonly id: string | number;
  readonly properties: any;
  readonly geometry: Geometry;
  // index values from bbox
  readonly metadata: Metadata;
}

/**
 * Indexering: 4 indexen op minx, miny, maxx, maxy en intersect nemen?
 */
const openStore = (storename: string): rx.Observable<idb.DB> => {
  return rx.from(
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

export const clear: (storename: string) => rx.Observable<void> = <T>(storename: string) => {
  return openStore(storename).pipe(
    switchMap(db =>
      rx.from(
        db
          .transaction(storename, "readwrite")
          .objectStore<T, any>(storename)
          .clear()
      )
    )
  );
};

export const deleteFeatures = (storename: string, extent: ol.Extent): rx.Observable<number> =>
  rx
    .forkJoin(
      getLowerKeys(storename, "minx", extent[0]),
      getLowerKeys(storename, "miny", extent[1]),
      getUpperKeys(storename, "maxx", extent[2]),
      getUpperKeys(storename, "maxy", extent[3])
    )
    .pipe(
      map(([minXs, minYs, maxXs, maxYs]) => intersect(maxYs, intersect(maxXs, intersect(minXs, minYs)))),
      switchMap(keys => deleteFeaturesByKeys(storename, keys))
    );

const deleteFeaturesByKeys = (storename: string, keys: any[]): rx.Observable<number> =>
  openStore(storename).pipe(
    switchMap(db => {
      const tx = db.transaction(storename, "readwrite");
      keys.forEach(key => tx.objectStore<GeoJsonLike, any>(storename).delete(key));
      return rx.from(tx.complete).pipe(mapTo(keys.length));
    })
  );

export const writeFeatures = (storename: string, features: GeoJsonLike[]): rx.Observable<number> =>
  openStore(storename).pipe(switchMap(db => writeMany<GeoJsonLike>(db, storename, features)));

export const getFeature = (storename: string, id: any): rx.Observable<GeoJsonLike> =>
  openStore(storename).pipe(switchMap(db => unsafeGet<GeoJsonLike>(db, storename, id)));

export const getFeatures = (storename: string, filterFunc: Predicate<GeoJsonLike>): rx.Observable<GeoJsonLike[]> =>
  openStore(storename).pipe(switchMap(db => unsafeGetAll<GeoJsonLike>(db, storename).pipe(map(features => features.filter(filterFunc)))));

export const getFeaturesByIds = (storename: string, keys: any[]): rx.Observable<GeoJsonLike> =>
  openStore(storename).pipe(switchMap(db => rx.from(keys.map(key => unsafeGet<GeoJsonLike>(db, storename, key))).pipe(mergeAll())));

export const getFeaturesByExtent = (storename: string, extent: ol.Extent): rx.Observable<GeoJsonLike> =>
  rx
    .forkJoin(
      getLowerKeys(storename, "minx", extent[0]),
      getLowerKeys(storename, "miny", extent[1]),
      getUpperKeys(storename, "maxx", extent[2]),
      getUpperKeys(storename, "maxy", extent[3])
    )
    .pipe(
      // 3 intersects omdat we op 4 verschillende indexes queryen. En dat doen we omdat de features zelf een bounding box hebben en dus
      // verschillende minX, maxX en minY, maxY kunnen hebben.
      map(([minXs, minYs, maxXs, maxYs]) => intersect(maxYs, intersect(maxXs, intersect(minXs, minYs)))),
      switchMap(keys => getFeaturesByIds(storename, keys))
    );

export const getFeaturesByExtentTableScan = (storename: string, extent: ol.Extent): rx.Observable<GeoJsonLike[]> => {
  const [minx, miny, maxx, maxy] = extent;
  return getFeatures(
    storename,
    feature =>
      feature.metadata.minx >= minx && feature.metadata.maxx <= maxx && feature.metadata.miny >= miny && feature.metadata.maxy <= maxy
  );
};

const getLowerKeys = (storename: string, idx: string, bound: number): rx.Observable<any[]> =>
  openStore(storename).pipe(switchMap(db => unsafeGetAllKeys(db, storename, idx, IDBKeyRange.lowerBound(bound))));

const getUpperKeys = (storename: string, idx: string, bound: number): rx.Observable<any[]> =>
  openStore(storename).pipe(switchMap(db => unsafeGetAllKeys(db, storename, idx, IDBKeyRange.upperBound(bound))));

// Dit werkt omdat we in de praktijk enkel string en number gebruiken als ids
const intersect = <T>(a: T[], b: T[]) => a.filter(value => -1 !== b.indexOf(value));
