import { Function1 } from "fp-ts/lib/function";
import { isSome, Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { filter, map, skipUntil } from "rxjs/operators";

export type Pipeable<A, B> = Function1<rx.Observable<A>, rx.Observable<B>>;

/**
 * Transformeert waarden van A naar waarden van B mbv f, maar verhindert propagatie als
 * f undefined of null oplevert.
 *
 * @param f een transformatie van A naar B
 */
export function collect<A, B>(f: (a: A) => B): Pipeable<A, B> {
  return o =>
    o.pipe(
      map(f), //
      filter(b => b !== undefined && b !== null)
    );
}

/**
 * Transformeert waarden van optionele A's naar waarden van B mbv f indien de A's gedefinieerd zijn.
 *
 * @param f een transformatie van A naar B
 */
export function collectOption<A, B>(f: (a: A) => Option<B>): Pipeable<A, B> {
  return o =>
    o.pipe(
      map(f), //
      filter(isSome),
      map(v => v.value)
    );
}

/**
 * Transformeert waarden van optionele A's naar waarden van B mbv f indien de A's gedefinieerd zijn.
 *
 * @param f een transformatie van A naar B
 */
export const flatten: <A>(o: rx.Observable<Option<A>>) => rx.Observable<A> = <A>(o: rx.Observable<Option<A>>) =>
  o.pipe(
    filter(isSome), // emit niet als none
    map(v => v.value) // omwille van filter hierboven nooit undefined. Properder met switchMap en foldl, maar minder efficiënt.
  );

export interface TypedRecord {
  type: string;
}

export const ofType = <Target extends TypedRecord>(type: string) => (o: rx.Observable<TypedRecord>) =>
  o.pipe(filter(a => a.type === type)) as rx.Observable<Target>;

export function skipUntilInitialised<A>(): Pipeable<A, A> {
  // beperk tot messages nadat subscribe opgeroepen is: oorzaak is shareReplay(1) in internalmessages$
  return obs => obs.pipe(skipUntil(rx.Observable.timer(0)));
}
