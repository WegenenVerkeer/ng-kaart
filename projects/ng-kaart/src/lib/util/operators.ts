import { Function1, Function2, Refinement } from "fp-ts/lib/function";
import { isSome, Option } from "fp-ts/lib/Option";
import { Tuple } from "fp-ts/lib/Tuple";
import * as rx from "rxjs";
import { filter, map, scan, skipUntil, switchMap } from "rxjs/operators";

import { ReduceFunction } from "./function";
import { TypedRecord } from "./typed-record";

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
 * Filtert de gedefinieerde Option<A>'s en converteert ze naar A's.
 */
export const catOptions: <A>(o: rx.Observable<Option<A>>) => rx.Observable<A> = <A>(o: rx.Observable<Option<A>>) =>
  o.pipe(
    filter(isSome), // emit niet als none
    map(v => v.value) // omwille van filter hierboven nooit undefined. Properder met switchMap en foldl, maar minder efficiënt.
  );

function isOfType<A extends TypedRecord>(type: string): Refinement<TypedRecord, A> {
  return (rec): rec is A => rec.type === type;
}

export const fromRefinement: <A, B extends A>(_: Refinement<A, B>) => Pipeable<A, B> = refinement => obs => obs.pipe(filter(refinement));

export const ofType: <Target extends TypedRecord>(_: string) => Pipeable<TypedRecord, Target> = type => fromRefinement(isOfType(type));

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
    const subscription = source.subscribe({
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
    subscription.add(() => console.log("unsubscribing from " + lbl));
    return subscription;
  });

/**
 * Een uitbreiding van de bestaande scan functie. In tegenstelling tot de ingeboude functie, neemt deze implementatie
 * 2 observables (van een potentieel verschillend type) en 2 reductiefuncties en reduceert de begintoestand steeds
 * door de overeenkomstige reducerfunctie uit te voeren wanneer 1 van de observables een waarde produceert.
 * @param obsA Een producent van As
 * @param obsB Een producent van Bs
 * @param fa Een reducer van C en A
 * @param fb Een reducer van C en B
 * @param init De initiele waarde
 */
export function scan2<A, B, C>(
  obsA: rx.Observable<A>,
  obsB: rx.Observable<B>,
  fa: ReduceFunction<C, A>,
  fb: ReduceFunction<C, B>,
  init: C
): rx.Observable<C> {
  type Tagged = TaggedA | TaggedB;
  interface TaggedA {
    value: A;
    label: "A";
  }
  interface TaggedB {
    value: B;
    label: "B";
  }
  const TaggedA: Function1<A, TaggedA> = a => ({ value: a, label: "A" });
  const TaggedB: Function1<B, TaggedB> = b => ({ value: b, label: "B" });
  const TagA: Pipeable<A, TaggedA> = a$ => a$.pipe(map(TaggedA));
  const TagB: Pipeable<B, TaggedB> = b$ => b$.pipe(map(TaggedB));

  const accumulate: Function2<C, Tagged, C> = (c, tagged) => {
    switch (tagged.label) {
      case "A":
        return fa(c, tagged.value);
      case "B":
        return fb(c, tagged.value);
    }
  };

  return rx.merge(obsA.pipe(TagA), rx.merge(obsB.pipe(TagB))).pipe(scan(accumulate, init));
}

export function scanState<A, S, B>(obsA: rx.Observable<A>, runState: Function2<S, A, Tuple<S, B>>, seed: S, rseed: B): rx.Observable<B> {
  const initial: Tuple<S, B> = new Tuple(seed, rseed);

  const accumulate: Function2<Tuple<S, B>, A, Tuple<S, B>> = (ps, a) => runState(ps.fst, a);

  return obsA.pipe(
    scan(accumulate, initial),
    map(ps => ps.snd)
  );
}
