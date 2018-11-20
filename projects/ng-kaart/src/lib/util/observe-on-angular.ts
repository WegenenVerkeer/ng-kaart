import * as rx from "rxjs";

import { ZoneLike } from "./zone-like";

export function observeOnAngular<T>(zone: ZoneLike) {
  return (source: rx.Observable<T>) =>
    new rx.Observable<T>(observer => {
      return source.subscribe({
        next(x) {
          zone.run(() => observer.next(x));
        },
        error(err) {
          observer.error(err);
        },
        complete() {
          observer.complete();
        }
      });
    });
}
