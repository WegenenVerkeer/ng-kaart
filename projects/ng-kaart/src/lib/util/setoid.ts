import { eq } from "fp-ts";

import { Key, Kinded } from "./kinded";

/**
 * import { eq } from "fp-ts";
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
 * const eqA: eq.Eq<A> = eq.contramap(a => a.a)(eq.eqNumber);
 * const eqB: eq.Eq<B> = eq.contramap(b => b.b)(eq.eqString);
 * const eqT: eq.Eq<T> = byKindEq({
 *   a: eqA,
 *   b: eqB
 * });
 *
 */
export const byKindEq = <A extends Kinded<K>, K extends Key>(
  eqRecord: {
    [P in A["kind"]]: eq.Eq<
      A & { readonly kind: P; readonly [key: string]: any }
    >;
  }
) =>
  eq.fromEquals(
    (a1: A, a2: A) =>
      !!a1 && !!a2 && a1.kind === a2.kind && eqRecord[a1.kind].equals(a1, a2)
  );

export const singletonEq = eq.fromEquals(() => true);
