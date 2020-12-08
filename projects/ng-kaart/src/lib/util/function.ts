import { array, option } from "fp-ts";
import { Endomorphism } from "fp-ts/lib/function";
import { Lens, Setter } from "monocle-ts";

/**
 * Maakt adhv van 2 functies met hetzelfde domein een nieuwe functie met hetzelfde domein, naar het product van die functies as een tuple.
 */
export const expand2: <A, B, C>(
  f: (a: A) => B,
  g: (a: A) => C
) => (a: A) => [B, C] = (f, g) => (a) => [f(a), g(a)];

/**
 * Een functie zoals die typisch gebruikt wordt in reduce en scan: voegt een feit van type A toe aan een toestand S om een nieuwe
 * toestand S te bekomen. Deze naam drukt beter de intentie uit.
 */
export type ReduceFunction<S, A> = (s: S, a: A) => S;

/**
 * Maakt een ReduceFunction van een Monocle Setter. Wordt vaak gebruikt. Zou niet nodig zijn mochten de type reducers curried zijn.
 */
export const reducerFromSetter: <S, A>(
  _: Setter<S, A>
) => ReduceFunction<S, A> = (setter) => (s, a) => setter.set(a)(s);

/**
 * Maakt een ReduceFunction van een Monocle Lens. Legt meer requirements op dan nodig (Setter is genoeg), maar we hebben vaker Lenses.
 */
export const reducerFromLens: <S, A>(_: Lens<S, A>) => ReduceFunction<S, A> = (
  lens
) => reducerFromSetter(lens.asSetter());

/**
 * Een functie die een orderelatie oplegt aan zijn 2 argumenten.
 * < 0 = eerste kleiner dan tweede.
 * 0 = gelijk.
 * > 1 = eerste groter dan tweede.
 */
export type Comparator<A> = (a: A, aa: A) => number;

/**
 * Een side-effectful functie die waarden van type A consumeert en er "iets vies" mee doet.
 */
export type Consumer1<A> = (a: A) => void;

/**
 * Een side-effectful functie die waarden van type A en B consumeert en er "iets vies" mee doet.
 */
export type Consumer2<A, B> = (a: A, b: B) => void;

/**
 * Een functie die option.none terug geeft waar die niet gedefineerd is in het domein A.
 */
export type PartialFunction1<A, B> = (a: A) => option.Option<B>;

/**
 * Een functie die option.none terug geeft waar die niet gedefineerd is in het domein AxB.
 */
export type PartialFunction2<A, B, C> = (a: A, b: B) => option.Option<C>;

/**
 * Een (endo)functie die alle (endo)functies na elkaar uitvoert. Lijkt heel sterk op pipe/flow.
 */
export const applySequential: <S>(_: Endomorphism<S>[]) => Endomorphism<S> = (
  fs
) => (init) => fs.reduce((s, f) => f(s), init);

/**
 * Zet een functie die `null` of `undefined` kan genereren om naar 1 die `option.Option` genereert.
 */
export function fromNullableFunc<A, B>(
  f: (a: A) => B | undefined
): (a: A) => option.Option<B> {
  return (a: A) => option.fromNullable(f(a));
}

export function isNotNullObject(object: any) {
  return object && object instanceof Object;
}

export function isNotNull(object: any) {
  return object !== null;
}

export function flowSpy<A>(msg: string): Endomorphism<A> {
  return (a) => {
    console.log(msg, a);
    return a;
  };
}

/**
 * Een functie die toelaat om te reageren op wijzigingen veroorzaakt door een endomorfisme.
 * @param c functie die zowel oude als nieuwe waarde krijgt om er een nieuwe, nieuwe waarde mee te maken.
 */
export const withChange = <A, B>(c: (oldA: A, newA: A) => B) => (
  f: Endomorphism<A>
): ((a: A) => B) => (a) => c(a, f(a));

/**
 * Laat toe om een argument te gebruiken om meerdere endomorfismen aan te sturen. Bijv. 2 setters obv dezelfde waarde.
 * @param fs functies van B die endomorfismen maken.
 */
export const distrib = <A, B>(
  ...fs: ((b: B) => Endomorphism<A>)[]
): ((b: B) => Endomorphism<A>) => (b: B) => (a: A) =>
  array.reduce<(b: B) => Endomorphism<A>, A>(a, (s, f) => f(b)(s))(fs);
