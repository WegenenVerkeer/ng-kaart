import { array, monoid, option } from "fp-ts";
import { intercalate } from "fp-ts/lib/Foldable2v";
import { Curried2, Endomorphism, Function1, Predicate } from "fp-ts/lib/function";
import { isString } from "util";

import { PartialFunction1 } from "./function";

export const minLength: Function1<number, Predicate<string>> = length => s => s.length >= length;
export const maxLength: Function1<number, Predicate<string>> = length => s => s.length <= length;

export const nonEmptyString: Predicate<string> = s => s.length > 0;
export const toLowerCaseString: Endomorphism<string> = s => s.toLowerCase();
export const toUpperCaseString: Endomorphism<string> = s => s.toUpperCase();

export const join: Curried2<string, string[], string> = sep => a => intercalate(monoid.monoidString, array.array)(sep, a);

export const asString: PartialFunction1<unknown, string> = option.fromRefinement(isString);
