import * as rx from "rxjs";
import { observeOn } from "rxjs/operators";

import { observeOnAngular } from "./observe-on-angular";
import { ZoneLike } from "./zone-like";

export function observeAsapOnAngular<T>(zone: ZoneLike) {
  return (source: rx.Observable<T>) =>
    source.pipe(observeOn(rx.asapScheduler), observeOnAngular(zone));
}
