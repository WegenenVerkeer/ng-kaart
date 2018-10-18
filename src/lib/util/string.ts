import { Endomorphism, Function1, Predicate } from "fp-ts/lib/function";

export const minLength: Function1<number, Predicate<string>> = length => s => s.length >= length;
export const maxLength: Function1<number, Predicate<string>> = length => s => s.length <= length;

export const nonEmptyString: Predicate<string> = s => s.length > 0;
export const toLowerCaseString: Endomorphism<string> = s => s.toLowerCase();
export const toUpperCaseString: Endomorphism<string> = s => s.toUpperCase();
