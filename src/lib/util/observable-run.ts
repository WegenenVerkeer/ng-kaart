import { Observable } from "rxjs/Observable";
import { pipe } from "rxjs/Rx";
import { asap } from "rxjs/scheduler/asap";
import { takeUntil, observeOn } from "rxjs/operators";

import { ZoneLike } from "./zone-like";
import { leaveZone } from "../util/leave-zone";

export function terminateOnDestroyAndRunAsapOutsideOfAngular<T>(
  zone: ZoneLike,
  termination$: Observable<any>
): (obs: Observable<T>) => Observable<T> {
  return pipe(
    takeUntil(termination$), // terminate wanneer ngOnDestry aangeroepen wordt
    observeOn(asap), // voer uit onmiddellijk na de productie van een waarde (en niet in-lijn met de productie)
    leaveZone(zone) // voer uit buiten change detectie van Angular, want dat is traaaag
  );
}
