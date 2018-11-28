import { Predicate } from "fp-ts/lib/function";
import { fromNullable, fromPredicate, none, Option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import { Validation } from "fp-ts/lib/Validation";

export function forEach<T>(anOption: Option<T>, f: (t: T) => any): void {
  anOption.map(f);
}

export function containsText(anOption: Option<String>, text: string): boolean {
  return anOption.contains(setoidString, text);
}

export function fromValidation<L, A>(validation: Validation<L, A>): Option<A> {
  return validation.fold(() => none, some);
}

export function fromNullablePredicate<A>(predicate: Predicate<A>, a: A): Option<A> {
  return fromPredicate(predicate)(a).chain(fromNullable);
}
