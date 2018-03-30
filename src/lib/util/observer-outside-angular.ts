import { Observable } from "rxjs/Observable";

import { ZoneLike } from "./zone-like";

/**
 * Observable transformer die de subscribers (downstream) buiten de Angular zone laat werken.
 * De bedoeling is om Angular geen change detection te laten doen en zo performantie op te voeren.
 *
 * Te gebruiken met observeOnAngular wanneer de ketting van operaties gedaan is en er terug in de Angular zone
 * gewerkt mag worden. Uiteraard is het de bedoeling dat er geen veranderingen aan membervariablen e.d. gebeuren
 * tijdens het stuk van de pijplijn waar er buiten de Angular zone gewerkt wordt.
 *
 * Zie bijv. https://blog.thoughtram.io/angular/2017/02/21/using-zones-in-angular-for-better-performance.html
 */
export function observerOutsideAngular<T>(zone: ZoneLike) {
  return (source: Observable<T>) =>
    new Observable<T>(observer => {
      return source.subscribe({
        next(x) {
          zone.runOutsideAngular(() => observer.next(x));
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
