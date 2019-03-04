import * as idb from "idb";
import { from, Observable } from "rxjs";
import { map, mergeMap } from "rxjs/operators";

import { LaatsteCacheRefresh } from "../kaart/model-changes";

import * as indexeddb from "./indexeddb";

const indexedb_db_naam = "tilecache-metadata";

interface CacheUpdateInformatie {
  readonly laagnaam: string;
  readonly datum: string;
}

const openStore = (): Observable<idb.DB> => {
  return from(
    idb.openDb(indexedb_db_naam, 1, upgradeDB => {
      switch (upgradeDB.oldVersion) {
        case 0:
          upgradeDB.createObjectStore(indexedb_db_naam, { keyPath: "laagnaam" });
      }
    })
  );
};

export const write = (laagnaam: string, datum: Date): Observable<IDBValidKey> =>
  openStore().pipe(
    mergeMap(db =>
      indexeddb.write<CacheUpdateInformatie>(db, indexedb_db_naam, {
        laagnaam: laagnaam,
        datum: datum.toISOString()
      })
    )
  );

export const read = (laagnaam: string): Observable<Date> =>
  openStore().pipe(
    mergeMap(db => indexeddb.get<CacheUpdateInformatie>(db, indexedb_db_naam, laagnaam).pipe(map(record => new Date(record.datum))))
  );

export const readAll = (): Observable<LaatsteCacheRefresh> =>
  openStore().pipe(
    mergeMap(db =>
      indexeddb.getAll<CacheUpdateInformatie>(db, indexedb_db_naam).pipe(
        map(record => {
          return { [record.laagnaam]: new Date(record.datum) };
        })
      )
    )
  );
