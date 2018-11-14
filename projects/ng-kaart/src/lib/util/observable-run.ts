import * as rx from "rxjs";
import { observeOn, takeUntil } from "rxjs/operators";

import { observeOutsideAngular } from "./observer-outside-angular";
import { ZoneLike } from "./zone-like";

export function terminateOnDestroyAndRunAsapOutsideOfAngular<T>(
  zone: ZoneLike,
  termination$: rx.Observable<any>
): (obs: rx.Observable<T>) => rx.Observable<T> {
  return rx.pipe(
    takeUntil(termination$), // terminate wanneer ngOnDestry aangeroepen wordt
    observeOn(rx.asapScheduler), // voer uit onmiddellijk na de productie van een waarde (en niet in-lijn met de productie)
    observeOutsideAngular(zone) // voer uit buiten change detectie van Angular, want dat is traaaag
  );
}
