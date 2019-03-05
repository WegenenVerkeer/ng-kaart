import * as idb from "idb";
import * as rx from "rxjs";
import { map, mergeMap } from "rxjs/operators";

import { LaatsteCacheRefresh } from "../kaart/model-changes";

import * as indexeddb from "./indexeddb";

const databaseNaam = "tilecache-metadata";

export interface CacheUpdateInformatie {
  readonly laagnaam: string;
  readonly datum: string;
}

const openStore = (): rx.Observable<idb.DB> => {
  return rx.from(
    idb.openDb(databaseNaam, 1, upgradeDB => {
      switch (upgradeDB.oldVersion) {
        case 0:
          upgradeDB.createObjectStore(databaseNaam, { keyPath: "laagnaam" });
      }
    })
  );
};

export const write = (laagnaam: string, datum: Date): rx.Observable<IDBValidKey> =>
  openStore().pipe(
    mergeMap(db =>
      indexeddb.write<CacheUpdateInformatie>(db, databaseNaam, {
        laagnaam: laagnaam,
        datum: datum.toISOString()
      })
    )
  );

export const read = (laagnaam: string): rx.Observable<Date> =>
  openStore().pipe(
    mergeMap(db => indexeddb.get<CacheUpdateInformatie>(db, databaseNaam, laagnaam).pipe(map(record => new Date(record.datum))))
  );

export const readAll = (): rx.Observable<CacheUpdateInformatie[]> =>
  openStore().pipe(mergeMap(db => indexeddb.getAll<CacheUpdateInformatie>(db, databaseNaam)));
