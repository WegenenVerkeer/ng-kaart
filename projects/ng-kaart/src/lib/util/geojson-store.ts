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
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

export const openStore = (storename: string): Promise<idb.DB> => {
  return idb.openDb(indexedb_db_naam, 1, upgradeDB => {
    // Note: we don't use 'break' in this switch statement,
    // the fall-through behaviour is what we want.
    switch (upgradeDB.oldVersion) {
      case 0:
        const store = upgradeDB.createObjectStore(storename, { keyPath: "id" });
        store.createIndex("minx", "minx", { unique: false });
        store.createIndex("miny", "miny", { unique: false });
        store.createIndex("maxx", "maxx", { unique: false });
        store.createIndex("maxy", "maxy", { unique: false });
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
    tx.objectStore<GeoJsonLike, any>(storename).put(feature, feature.id);
    return tx.complete;
  });

export const writeFeatures = (storename: string, features: GeoJsonLike[]): Promise<void> =>
  openStore(storename).then(db => {
    const tx = db.transaction(storename, "readwrite");
    features.map(feature => tx.objectStore<GeoJsonLike, any>(storename).put(feature, feature.id));
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

export const getFeaturesByExtent = (storename: string, extent: ol.Extent): Promise<GeoJsonLike[]> => {
  // zoek via indexes ipv getFeatures(storename, feature => feature.getGeometry()["intersectsExtent"](extent));
  return getFeatures(storename, () => true);
};
