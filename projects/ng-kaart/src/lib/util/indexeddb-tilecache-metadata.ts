import * as idb from "idb";
import { from, Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";

import { get, write } from "./indexeddb";

const indexedb_db_naam = "tilecache-metadata";

export interface CacheInformation {
  readonly layer: string;
  readonly refreshed: Date;
}

const openStore = (): Observable<idb.DB> => {
  return from(
    idb.openDb(indexedb_db_naam, 1, upgradeDB => {
      switch (upgradeDB.oldVersion) {
        case 0:
          const store = upgradeDB.createObjectStore(indexedb_db_naam, { keyPath: "layer" });
      }
    })
  );
};

export const writeInfo = (layer: string, datum: Date): Observable<number> =>
  openStore().pipe(
    mergeMap(db =>
      write<CacheInformation>(db, indexedb_db_naam, {
        layer: layer,
        refreshed: datum
      })
    )
  );

export const readInfo = (layer: string): Observable<CacheInformation> =>
  openStore().pipe(mergeMap(db => get<CacheInformation>(db, indexedb_db_naam, layer)));
