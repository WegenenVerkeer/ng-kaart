import { array, foldable, monoid, option } from "fp-ts";
import { Endomorphism, flow, Predicate } from "fp-ts/lib/function";

import { PartialFunction1 } from "./function";

export const minLength: (number) => Predicate<string> = (length) => (s) =>
  s.length >= length;
export const maxLength: (number) => Predicate<string> = (length) => (s) =>
  s.length <= length;

export const nonEmptyString: Predicate<string> = (s) => s.length > 0;
export const toLowerCaseString: Endomorphism<string> = (s) => s.toLowerCase();
export const toUpperCaseString: Endomorphism<string> = (s) => s.toUpperCase();

export const join: (sep: string) => (a: string[]) => string = (sep) => (a) =>
  foldable.intercalate(monoid.monoidString, array.array)(sep, a);

export const isString = (obj: any): obj is string => typeof obj === "string";

export const asString: PartialFunction1<unknown, string> = flow(
  option.fromNullable,
  option.filter(isString)
);
