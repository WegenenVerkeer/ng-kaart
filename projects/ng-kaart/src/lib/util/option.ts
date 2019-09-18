import { option, record } from "fp-ts";
import { Predicate } from "fp-ts/lib/function";
import { fromNullable, fromPredicate, none, Option, some, URI as OptionURI } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import { Validation } from "fp-ts/lib/Validation";
import { isNullOrUndefined } from "util";

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

export function toArray<A>(maybeA: Option<A>): A[] {
  return maybeA.fold([], a => [a]);
}

export type NoOption<A> = A extends Option<infer B> ? B | undefined : A;

export type NoOptionRecord<A> = { readonly [P in keyof A]: NoOption<A[P]> };

export function isOption<A>(v: unknown): v is Option<A> {
  return !isNullOrUndefined(v) && typeof v === "object" && ((v as any)._tag === "Some" || (v as any)._tag === "None");
}

function valueToUndefined(v: unknown): unknown {
  return isOption(v) ? option.toUndefined(v) : v;
}

export function optionsToUndefined<A extends Record<string, unknown>>(a: A): NoOptionRecord<A> {
  return (record.map(valueToUndefined)(a) as unknown) as NoOptionRecord<A>;
}
