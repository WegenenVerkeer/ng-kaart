import { DB } from "idb";
import { from, Observable } from "rxjs";
import { map, mergeAll } from "rxjs/operators";

export const get = <T>(db: DB, storename: string, key: any): Observable<T> =>
  from(
    db
      .transaction(storename)
      .objectStore<T, any>(storename)
      .get(key)
  );

export const deleteFeature = <T>(db: DB, storename: string, key: any): Observable<void> =>
  from(
    db
      .transaction(storename)
      .objectStore<T, any>(storename)
      .delete(key)
  );

export const getAll = <T>(db: DB, storename: string): Observable<T[]> =>
  from(
    db
      .transaction(storename)
      .objectStore<T, any>(storename)
      .getAll()
  );

export const getAllKeys = <T>(db: DB, storename: string, idx: string, keyRange: IDBKeyRange): Observable<any[]> =>
  from(
    db
      .transaction(storename)
      .objectStore<T, any>(storename)
      .index(idx)
      .getAllKeys(keyRange)
  );

export const write = <T>(db: DB, storename: string, feature: T): Observable<IDBValidKey> =>
  from(
    db
      .transaction(storename, "readwrite")
      .objectStore<T, any>(storename)
      .put(feature)
  );

export const writeMany = <T>(db: DB, storename: string, features: T[]): Observable<number> => {
  const tx = db.transaction(storename, "readwrite");
  features.map(feature => tx.objectStore<T, any>(storename).put(feature));
  return from(tx.complete).pipe(map(() => features.length));
};
