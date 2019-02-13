import { Function1 } from "fp-ts/lib/function";
import * as idb from "idb";

const indexedb_db_naam = "nosql-features";

export interface GeoJsonLike {
  id: any;
  properties: any;
  geometry: {
    bbox: [number, number, number, number];
    coordinates: number[];
    crs: any;
    type: string;
  };
  // index values from bbox
  metadata: {
    minx: number;
    miny: number;
    maxx: number;
    maxy: number;
    toegevoegd: Date;
  };
}

/**
 * Indexering: 4 indexen op minx, miny, maxx, maxy en intersect nemen?
 */
const openStore = (storename: string): Promise<idb.DB> => {
  return idb.openDb(indexedb_db_naam, 1, upgradeDB => {
    // Note: we don't use 'break' in this switch statement,
    // the fall-through behaviour is what we want.
    switch (upgradeDB.oldVersion) {
      case 0:
        const store = upgradeDB.createObjectStore(storename, { keyPath: "id" });
        store.createIndex("minx", "metadata.minx", { unique: false });
        store.createIndex("miny", "metadata.miny", { unique: false });
        store.createIndex("maxx", "metadata.maxx", { unique: false });
        store.createIndex("maxy", "metadata.maxy", { unique: false });
    }
  });
};

export const clear = (storename: string): Promise<void> =>
  openStore(storename).then(db =>
    db
      .transaction(storename, "readwrite")
      .objectStore<GeoJsonLike, any>(storename)
      .clear()
  );

export const writeFeature = (storename: string, feature: GeoJsonLike): Promise<void> =>
  openStore(storename).then(db => {
    const tx = db.transaction(storename, "readwrite");
    tx.objectStore<GeoJsonLike, any>(storename).put(feature);
    return tx.complete;
  });

export const writeFeatures = (storename: string, features: GeoJsonLike[]): Promise<void> =>
  openStore(storename).then(db => {
    const tx = db.transaction(storename, "readwrite");
    features.map(feature => tx.objectStore<GeoJsonLike, any>(storename).put(feature));
    return tx.complete;
  });

export const getFeature = (storename: string, id: any): Promise<GeoJsonLike> =>
  openStore(storename).then(db =>
    db
      .transaction(storename)
      .objectStore<GeoJsonLike, any>(storename)
      .get(id)
  );

export const getFeatures = (storename: string, filter: Function1<GeoJsonLike, boolean>): Promise<GeoJsonLike[]> =>
  openStore(storename)
    .then(db =>
      db
        .transaction(storename)
        .objectStore<GeoJsonLike, any>(storename)
        .getAll()
    )
    .then(features => features.filter(filter));

export const getFeaturesByIds = (storename: string, keys: any[]): Promise<GeoJsonLike[]> =>
  openStore(storename)
    .then(db => db.transaction(storename).objectStore<GeoJsonLike, any>(storename))
    .then(os => Promise.all(keys.map(key => os.get(key))));

export const getFeaturesByExtent = (storename: string, extent: ol.Extent): Promise<GeoJsonLike[]> => {
  return Promise.all([
    getLower(storename, "minx", extent[0]),
    getLower(storename, "miny", extent[1]),
    getUpper(storename, "maxx", extent[2]),
    getUpper(storename, "maxy", extent[3])
  ])
    .then(([minXs, minYs, maxXs, maxYs]) => intersect(maxYs, intersect(maxXs, intersect(minXs, minYs))))
    .then(keys => getFeaturesByIds(storename, keys));
  // .then(keys => getFeatures(storename, feature => keys.includes(feature.id)))
};

export const getFeaturesByExtentTableScan = (storename: string, extent: ol.Extent): Promise<GeoJsonLike[]> => {
  const [minx, miny, maxx, maxy] = extent;
  return getFeatures(
    storename,
    feature =>
      feature.metadata.minx >= minx && feature.metadata.maxx <= maxx && feature.metadata.miny >= miny && feature.metadata.maxy <= maxy
  );
};

const getLower = (storename: string, idx: string, bound: number) =>
  openStore(storename).then(db =>
    db
      .transaction(storename)
      .objectStore<GeoJsonLike, any>(storename)
      .index(idx)
      .getAllKeys(IDBKeyRange.lowerBound(bound))
  );

const getUpper = (storename: string, idx: string, bound: number) =>
  openStore(storename).then(db =>
    db
      .transaction(storename)
      .objectStore<GeoJsonLike, any>(storename)
      .index(idx)
      .getAllKeys(IDBKeyRange.upperBound(bound))
  );

const intersect = <T>(a: T[], b: T[]) => a.filter(value => -1 !== b.indexOf(value));
