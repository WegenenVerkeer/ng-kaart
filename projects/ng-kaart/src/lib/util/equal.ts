import { Function1, Predicate } from "fp-ts/lib/function";
import { Setoid, setoidNumber, setoidString } from "fp-ts/lib/Setoid";

export const equalTo: <A>(setoid: Setoid<A>) => (a: A) => Predicate<A> = setoid => a1 => a2 => setoid.equals(a1, a2);
export const equalToString: Function1<String, Predicate<String>> = equalTo(setoidString);
export const equalToNumber: Function1<number, Predicate<number>> = equalTo(setoidNumber);
