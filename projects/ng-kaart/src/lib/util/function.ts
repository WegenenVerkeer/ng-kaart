import { Function1, Function2 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Lens, Setter } from "monocle-ts";

/**
 * Maakt adhv van 2 functies met hetzelfde domein een nieuwe functie met hetzelfde domein, naar het product van die functies as een tuple.
 */
export const expand2: <A, B, C>(f: Function1<A, B>, g: Function1<A, C>) => Function1<A, [B, C]> = (f, g) => a => [f(a), g(a)];

/**
 * Een functie zoals die typisch gebruikt wordt in reduce en scan: voegt een feit van type A toe aan een toestand S om een nieuwe
 * toestand S te bekomen. Deze naam drukt beter de intentie uit.
 */
export type ReduceFunction<S, A> = Function2<S, A, S>;

/**
 * Maakt een ReduceFunction van een Monocle Setter. Wordt vaak gebruikt. Zou niet nodig zijn mochten de type reducers curried zijn.
 */
export const reducerFromSetter: <S, A>(_: Setter<S, A>) => ReduceFunction<S, A> = setter => (s, a) => setter.set(a)(s);

/**
 * Maakt een ReduceFunction van een Monocle Lens. Legt meer requirements op dan nodig (Setter is genoeg), maar we hebben vaker Lenses.
 */
export const reducerFromLens: <S, A>(_: Lens<S, A>) => ReduceFunction<S, A> = lens => reducerFromSetter(lens.asSetter());

/**
 * Een functie die een orderelatie oplegt aan zijn 2 argumenten.
 * < 0 = eerste kleiner dan tweede.
 * 0 = gelijk.
 * > 1 = eerste groter dan tweede.
 */
export type Comparator<A> = Function2<A, A, number>;

/**
 * Een side-effectful functie die waarden van type A consumeert en er "iets vies" mee doet.
 */
export type Consumer<A> = (a: A) => void;

/**
 * Een functie die none terug geeft waar die niet gedefineerd is in het domein A.
 */
export type PartialFunction1<A, B> = Function1<A, Option<B>>;

/**
 * Een functie die none terug geeft waar die niet gedefineerd is in het domein AxB.
 */
export type PartialFunction2<A, B, C> = Function2<A, B, Option<C>>;
