import { eq } from "fp-ts";
import { Function1, Predicate } from "fp-ts/lib/function";

export const equalTo: <A>(setoid: eq.Eq<A>) => (a: A) => Predicate<A> = setoid => a1 => a2 => setoid.equals(a1, a2);
export const equalToString: Function1<String, Predicate<String>> = equalTo(eq.eqString);
export const equalToNumber: Function1<number, Predicate<number>> = equalTo(eq.eqNumber);
