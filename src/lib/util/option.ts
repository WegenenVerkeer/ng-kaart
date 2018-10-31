import { none, Option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import { Validation } from "fp-ts/lib/Validation";
import { Optional } from "monocle-ts";

export function forEach<T>(anOption: Option<T>, f: (t: T) => any): void {
  anOption.map(f);
}

export function containsText(anOption: Option<String>, text: string): boolean {
  return anOption.contains(setoidString, text);
}

export function fromValidation<L, A>(validation: Validation<L, A>): Option<A> {
  return validation.fold(() => none, some);
}

type OptionPropertyNames<T, U> = { [K in keyof T]: T[K] extends Option<U> ? K : never }[keyof T];
type OptionProperties<T, U> = Pick<T, OptionPropertyNames<T, U>>;

export function OptionalFromOptionProp<S extends object, T, P extends keyof OptionProperties<S, T>>(prop: P): Optional<S, T> {
  return new Optional(s => (s[prop] as any) as Option<T>, a => s => Object.assign({}, s, { [prop as any]: a }));
}
