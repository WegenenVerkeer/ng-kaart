import { DB } from "idb";
import { from, Observable } from "rxjs";
import { filter, mapTo } from "rxjs/operators";

// Wrappers rond idb functies die Promises omzetten naar observables

export type StoreKey = any;

// Als de key er niet is, dan zal de Observable niet emitten (maar wel afsluiten).
export const unsafeGet = <T>(db: DB, storename: string, key: StoreKey): Observable<T> =>
  from(
    db
      .transaction(storename)
      .objectStore(storename)
      .get(key)
  ).pipe(filter(t => t !== undefined));

export const deleteFeature = <T>(db: DB, storename: string, key: StoreKey): Observable<void> =>
  from(
    db
      .transaction(storename)
      .objectStore(storename)
      .delete(key)
  );

// We gaan er van uit dat de store effectief enkel objecten van type T bevat
export const unsafeGetAll = <T>(db: DB, storename: string): Observable<T[]> =>
  from(
    db
      .transaction(storename)
      .objectStore(storename)
      .getAll()
  );

export const unsafeGetAllKeys = <T>(db: DB, storename: string, idx: string, keyRange: IDBKeyRange): Observable<T[]> =>
  from(
    db
      .transaction(storename)
      .objectStore(storename)
      .index(idx)
      .getAllKeys(keyRange)
  );

export const put = <T>(db: DB, storename: string, feature: T): Observable<IDBValidKey> =>
  from(
    db
      .transaction(storename, "readwrite")
      .objectStore(storename)
      .put(feature)
  );

export const writeMany = <T>(db: DB, storename: string, features: T[]): Observable<number> => {
  const tx = db.transaction(storename, "readwrite");
  features.map(feature => tx.objectStore(storename).put(feature));
  return from(tx.complete).pipe(mapTo(features.length));
};
