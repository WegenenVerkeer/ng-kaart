import { Function1 } from "fp-ts/lib/function";
import { isSome, Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { filter, map, skipUntil, switchMap } from "rxjs/operators";

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

/**
 * Zorgt er voor dat eventuele replaywaarden overgeslagen worden tot het moment dat deze functie aangeroepen wordt.
 */
export const skipOlder: <A>() => Pipeable<A, A> = () => obs => obs.pipe(skipUntil(rx.timer(0)));

/**
 * Een alias voor switchMap die de intentie uitdrukt. Voor elke emit van de `restarter` observable zal er een observable gecreëerd worden
 * op basis van de emit waarde en de opgegeven functie `fObs`.
 */
export const forEvery: <A>(_: rx.Observable<A>) => <B>(_: Function1<A, rx.Observable<B>>) => rx.Observable<B> = restarter => fObs =>
  restarter.pipe(switchMap(fObs));

/**
 * Een handige helper om na te gaan waarom events niet doorstromen. Met tap kunnen we wel next e.d. opvangen, maar vaak is het heel
 * interessant om te weten of en wanneer een observable gesubscribed wordt.
 * Het is uiteraard niet de bedoeling code die hiervan gebruikt maakt te releasen.
 */
export const subSpy: (_: string) => <A>(_: rx.Observable<A>) => rx.Observable<A> = lbl => source =>
  new rx.Observable(observer => {
    console.log("subscribing to " + lbl);
    return source.subscribe({
      next(x) {
        console.log("emitting from " + lbl, x);
        observer.next(x);
      },
      error(err) {
        console.log("error for " + lbl, err);
        observer.error(err);
      },
      complete() {
        console.log("completing " + lbl);
        observer.complete();
      }
    });
  });
