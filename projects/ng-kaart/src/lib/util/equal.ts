import { eq } from "fp-ts";
import { Predicate } from "fp-ts/lib/function";

export const equalTo: <A>(setoid: eq.Eq<A>) => (a: A) => Predicate<A> = (
  setoid
) => (a1) => (a2) => setoid.equals(a1, a2);
export const equalToString: (s: String) => Predicate<String> = equalTo(
  eq.eqString
);
export const equalToNumber: (n: number) => Predicate<number> = equalTo(
  eq.eqNumber
);
