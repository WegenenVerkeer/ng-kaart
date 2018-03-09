import { Observable } from "rxjs/Observable";

import { ZoneLike } from "./zone-like";

export function observeOnAngular<T>(zone: ZoneLike) {
  return (source: Observable<T>) =>
    new Observable<T>(observer => {
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
