import { Cursor, DB } from "idb";
import * as rx from "rxjs";
import { filter, mapTo } from "rxjs/operators";

// Wrappers rond idb functies die Promises omzetten naar observables

export type StoreKey = any;

const toException: (reason: any) => Error = reason => new Error("Kon niet lezen van IndexedDB: " + reason);

// Als de key er niet is, dan zal de Observable niet emitten (maar wel afsluiten).
export const unsafeGet = <T>(db: DB, storeName: string, key: StoreKey): rx.Observable<T> =>
  rx
    .from(
      db
        .transaction(storeName)
        .objectStore(storeName)
        .get(key)
    )
    .pipe(filter(t => t !== undefined));

export const deleteFeature = <T>(db: DB, storeName: string, key: StoreKey): rx.Observable<void> =>
  rx.from(
    db
      .transaction(storeName)
      .objectStore(storeName)
      .delete(key)
  );

// We gaan er van uit dat de store effectief enkel objecten van type T bevat
export const unsafeGetAll = <T>(db: DB, storeName: string): rx.Observable<T> =>
  rx.Observable.create((subscriber: rx.Subscriber<T>) =>
    db
      .transaction(storeName)
      .objectStore(storeName)
      .openCursor()
      .then(
        function cursorIterate(cursor: Cursor<any, any>) {
          if (!cursor) {
            subscriber.complete();
            return;
          }
          subscriber.next(cursor.value);
          cursor.continue().then(cursorIterate, reason => subscriber.error(toException(reason)));
        },
        reason => subscriber.error(toException(reason))
      )
  );

export const unsafeGetAllKeys = <T>(db: DB, storeName: string, idx: string, keyRange: IDBKeyRange): rx.Observable<T> =>
  rx.Observable.create((subscriber: rx.Subscriber<T>) =>
    db
      .transaction(storeName)
      .objectStore(storeName)
      .index(idx)
      .openKeyCursor(keyRange)
      .then(
        function cursorIterate(cursor: Cursor<any, any>) {
          if (!cursor) {
            subscriber.complete();
            return;
          }
          subscriber.next(cursor.primaryKey);
          cursor.continue().then(cursorIterate, reason => subscriber.error(toException(reason)));
        },
        reason => subscriber.error(toException(reason))
      )
  );

export const put = <T>(db: DB, storeName: string, feature: T): rx.Observable<IDBValidKey> =>
  rx.from(
    db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .put(feature)
  );

export const writeMany = <T>(db: DB, storeName: string, features: T[]): rx.Observable<number> => {
  const tx = db.transaction(storeName, "readwrite");
  features.map(feature => tx.objectStore(storeName).put(feature));
  return rx.from(tx.complete).pipe(mapTo(features.length));
};
