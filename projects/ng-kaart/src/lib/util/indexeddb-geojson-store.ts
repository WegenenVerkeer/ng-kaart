import { array } from "fp-ts";
import { Predicate } from "fp-ts/lib/function";
import * as idb from "idb";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { filter, map, mapTo, mergeAll, mergeMap, reduce, switchMap } from "rxjs/operators";

import { GeoJsonKeyType, GeoJsonLike } from "./geojson-types";
import { unsafeGet, unsafeGetAll, unsafeGetAllByIndex, unsafeGetAllKeys, writeMany } from "./indexeddb";

const dbNaam = "nosql-features";

/**
 * Indexering: 4 indexen op minx, miny, maxx, maxy en intersect nemen?
 */
const openStore = (storeName: string): rx.Observable<idb.DB> => {
  return rx.from(
    idb.openDb(dbNaam, 1, upgradeDB => {
      switch (upgradeDB.oldVersion) {
        case 0:
          const store = upgradeDB.createObjectStore(storeName, { keyPath: "id" });
          store.createIndex("minx", "metadata.minx", { unique: false });
          store.createIndex("miny", "metadata.miny", { unique: false });
      }
    })
  );
};

export const clear: (storeName: string) => rx.Observable<void> = (storeName: string) => {
  return openStore(storeName).pipe(
    switchMap(db =>
      rx.from(
        db
          .transaction(storeName, "readwrite")
          .objectStore(storeName)
          .clear()
      )
    )
  );
};

export const deleteFeatures = (storeName: string, extent: ol.Extent): rx.Observable<number> =>
  getKeysForFeaturesInExtent(storeName, extent).pipe(
    reduce(array.snoc, []),
    mergeMap(keys => deleteFeaturesByKeys(storeName, keys))
  );

const deleteFeaturesByKeys = (storeName: string, keys: GeoJsonKeyType[]): rx.Observable<number> =>
  openStore(storeName).pipe(
    switchMap(db => {
      const tx = db.transaction(storeName, "readwrite");
      keys.forEach(key => tx.objectStore(storeName).delete(key));
      return rx.from(tx.complete).pipe(mapTo(keys.length));
    })
  );

export const writeFeatures = (storeName: string, features: GeoJsonLike[]): rx.Observable<number> =>
  openStore(storeName).pipe(switchMap(db => writeMany(db, storeName, features)));

export const getFeature = (storeName: string, id: any): rx.Observable<GeoJsonLike> =>
  openStore(storeName).pipe(switchMap(db => unsafeGet<GeoJsonLike>(db, storeName, id)));

export const getAllFeatures = (storeName: string): rx.Observable<GeoJsonLike> =>
  openStore(storeName).pipe(switchMap(db => unsafeGetAll<GeoJsonLike>(db, storeName)));

export const getFeatures = (storeName: string, filterFunc: Predicate<GeoJsonLike>): rx.Observable<GeoJsonLike> =>
  getAllFeatures(storeName).pipe(filter(filterFunc));

export const getFeaturesByIds = (storeName: string, keys: GeoJsonKeyType[]): rx.Observable<GeoJsonLike> =>
  openStore(storeName).pipe(switchMap(db => rx.from(keys.map(key => unsafeGet<GeoJsonLike>(db, storeName, key))).pipe(mergeAll())));

export const getFeaturesByExtent = (storeName: string, extent: ol.Extent): rx.Observable<GeoJsonLike> => {
  const [minx, miny, maxx, maxy] = extent;
  const values$ =
    maxx - minx < maxy - miny
      ? getValuesInIndexedInRange(storeName, "minx", minx, maxx)
      : getValuesInIndexedInRange(storeName, "miny", miny, maxy);
  return values$.pipe(
    filter(
      feature =>
        feature.metadata.minx >= minx && feature.metadata.maxx <= maxx && feature.metadata.miny >= miny && feature.metadata.maxy <= maxy
    )
  );
};

const getKeysForFeaturesInExtent = (storeName: string, extent: ol.Extent): rx.Observable<GeoJsonKeyType> =>
  getFeaturesByExtent(storeName, extent).pipe(map(f => f.id));

const getValuesInIndexedInRange = (
  storeName: string,
  idx: string,
  lower: GeoJsonKeyType,
  upper: GeoJsonKeyType
): rx.Observable<GeoJsonLike> =>
  openStore(storeName).pipe(switchMap(db => unsafeGetAllByIndex<GeoJsonLike>(db, storeName, idx, IDBKeyRange.bound(lower, upper))));
