import { Predicate } from "fp-ts/lib/function";
import * as idb from "idb";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map, mapTo, mergeAll, mergeMap, switchMap } from "rxjs/operators";

import { GeoJsonKeyType, GeoJsonLike } from "./geojson-types";
import { unsafeGet, unsafeGetAll, unsafeGetAllKeys, writeMany } from "./indexeddb";

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
          store.createIndex("maxx", "metadata.maxx", { unique: false });
          store.createIndex("maxy", "metadata.maxy", { unique: false });
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
  getKeysForFeaturesInExtent(storeName, extent).pipe(mergeMap(keys => deleteFeaturesByKeys(storeName, keys)));

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

export const getAllFeatures = (storeName: string): rx.Observable<GeoJsonLike[]> =>
  openStore(storeName).pipe(switchMap(db => unsafeGetAll<GeoJsonLike>(db, storeName)));

export const getFeatures = (storeName: string, filterFunc: Predicate<GeoJsonLike>): rx.Observable<GeoJsonLike[]> =>
  getAllFeatures(storeName).pipe(map(features => features.filter(filterFunc)));

export const getFeaturesByIds = (storeName: string, keys: GeoJsonKeyType[]): rx.Observable<GeoJsonLike> =>
  openStore(storeName).pipe(switchMap(db => rx.from(keys.map(key => unsafeGet<GeoJsonLike>(db, storeName, key))).pipe(mergeAll())));

export const getFeaturesByExtent = (storeName: string, extent: ol.Extent): rx.Observable<GeoJsonLike> =>
  getKeysForFeaturesInExtent(storeName, extent).pipe(mergeMap(keys => getFeaturesByIds(storeName, keys)));

export const getFeaturesByExtentTableScan = (storeName: string, extent: ol.Extent): rx.Observable<GeoJsonLike[]> => {
  const [minx, miny, maxx, maxy] = extent;
  return getFeatures(
    storeName,
    feature =>
      feature.metadata.minx >= minx && feature.metadata.maxx <= maxx && feature.metadata.miny >= miny && feature.metadata.maxy <= maxy
  );
};

const getKeysForFeaturesInExtent = (storeName: string, extent: ol.Extent): rx.Observable<GeoJsonKeyType[]> =>
  rx
    .forkJoin(
      getKeysInRange(storeName, "minx", extent[0], extent[2]),
      getKeysInRange(storeName, "miny", extent[1], extent[3]),
      getKeysInRange(storeName, "maxx", extent[0], extent[2]),
      getKeysInRange(storeName, "maxy", extent[1], extent[3])
    )
    .pipe(
      // 3 intersects omdat we op 4 verschillende indexes queryen. En dat doen we omdat de features zelf een bounding box hebben en dus
      // verschillende minX, maxX en minY, maxY kunnen hebben.
      map(([minXs, minYs, maxXs, maxYs]) => intersect(maxYs, intersect(maxXs, intersect(minXs, minYs))))
    );

const getKeysInRange = (storeName: string, idx: string, lower: GeoJsonKeyType, upper: GeoJsonKeyType): rx.Observable<GeoJsonKeyType[]> =>
  openStore(storeName).pipe(switchMap(db => unsafeGetAllKeys<GeoJsonKeyType>(db, storeName, idx, IDBKeyRange.bound(lower, upper))));

// Dit werkt omdat we in de praktijk enkel string en number gebruiken als ids
// TODO n^2 algoritme kan sneller
const intersect = <T extends GeoJsonKeyType>(a: T[], b: T[]) => a.filter(value => -1 !== b.indexOf(value));
