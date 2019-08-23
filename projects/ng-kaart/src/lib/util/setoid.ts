import { fromEquals, Setoid } from "fp-ts/lib/Setoid";

import { Key, Kinded } from "./kinded";

/**
 * import { contramap, fromEquals, Setoid, setoidNumber, setoidString } from "fp-ts/lib/Setoid";
 *
 * type T = A | B;
 * interface A {
 *   kind: "a";
 *   a: number;
 * }
 * interface B {
 *   kind: "b";
 *   b: string;
 * }
 * const setoidA: Setoid<A> = contramap(a => a.a, setoidNumber);
 * const setoidB: Setoid<B> = contramap(b => b.b, setoidString);
 * const setoidT: Setoid<T> = byKindSetoid({
 *   a: setoidA,
 *   b: setoidB
 * });
 *
 */
export const byKindSetoid = <A extends Kinded<K>, K extends Key>(
  setoidRecord: { [P in A["kind"]]: Setoid<A & { readonly kind: P; readonly [key: string]: any }> }
) => fromEquals((a1: A, a2: A) => !!a1 && !!a2 && a1.kind === a2.kind && setoidRecord[a1.kind].equals(a1, a2));

export const singletonSetoid = fromEquals(() => true);
