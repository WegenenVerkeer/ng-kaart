import { Observable } from "rxjs/Observable";
import "rxjs/add/operator/do";
import "rxjs/add/operator/publishReplay";
import { asap } from "rxjs/scheduler/asap";

import { ZoneLike } from "./zone-like";

export function terminateOnDestroyAndRunAsapOutsideOfAngular<T>(
  this: Observable<T>,
  zone: ZoneLike,
  termination$: Observable<any>
): Observable<T> {
  return this.takeUntil(termination$) // terminate wanneer ngOnDestry aangeroepen wordt
    .observeOn(asap) // voer uit onmiddellijk na de productie van een waarde (en niet in-lijn met de productie)
    .leaveZone(zone); // voer uit buiten change detectie van Angular, want dat is traaaag
}

// Add the operator to the Observable prototype:

Observable.prototype.terminateOnDestroyAndRunAsapOutsideOfAngular = terminateOnDestroyAndRunAsapOutsideOfAngular;

// Extend the TypeScript interface for Observable to include the operator:

declare module "rxjs/Observable" {
  // tslint:disable-next-line:no-shadowed-variable
  interface Observable<T> {
    /**
     * Operator die er voor zorgt dat een Observable uitgevoerd wordt buiten de Angular zone en zo vlug mogelijk
     * nadat een waarde geproduceerd wordt in de Observable. Bovendien wordt de Observable afgesloten zodra de
     * `destroying` observable een waarde produceert.
     * Zonder de asap wordt de subscribe operatie immers (bij de meeste operators) uitgevoerd synchroon met de next.
     * maw, de aanroeper van de next is std geblokkeerd totdat de subscriber de waarde verwerkt heeft.
     * @param this de te decoreren observable
     * @param zone een object dat toelaat om bewerkingen buiten de Angular zone uit te voeren
     * @param termination$ een observable die wanneer er een waarde uitkomt unsubscribet van de te decoreren observable
     */
    terminateOnDestroyAndRunAsapOutsideOfAngular: typeof terminateOnDestroyAndRunAsapOutsideOfAngular;
  }
}
