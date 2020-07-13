import { eq, option, record, validation } from "fp-ts";
import { Predicate } from "fp-ts/lib/function";

import { isNotNullOrUndefined } from "./null";

export function forEach<T>(anOption: option.Option<T>, f: (t: T) => any): void {
  anOption.map(f);
}

export function containsText(anOption: option.Option<String>, text: string): boolean {
  return anOption.contains(eq.eqString, text);
}

export function fromValidation<L, A>(validation: validation.Validation<L, A>): option.Option<A> {
  return validation.fold(() => option.none, option.some);
}

export function fromNullablePredicate<A>(predicate: Predicate<A>, a: A): option.Option<A> {
  return option
    .fromPredicate(predicate)(a)
    .chain(option.fromNullable);
}

export function toArray<A>(maybeA: option.Option<A>): A[] {
  return maybeA.fold([], a => [a]);
}

export type NoOption<A> = A extends option.Option<infer B> ? B | undefined : A;

export type NoOptionRecord<A> = { readonly [P in keyof A]: NoOption<A[P]> };

export function isOption<A>(v: unknown): v is option.Option<A> {
  return isNotNullOrUndefined(v) && typeof v === "object" && ((v as any)._tag === "Some" || (v as any)._tag === "None");
}

function valueToUndefined(v: unknown): unknown {
  return isOption(v) ? option.toUndefined(v) : v;
}

export function optionsToUndefined<A extends object>(a: A): NoOptionRecord<A> {
  return (record.map(valueToUndefined)(a) as unknown) as NoOptionRecord<A>;
}
