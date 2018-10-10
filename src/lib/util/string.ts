import { Function1, Predicate } from "fp-ts/lib/function";

export const minLength: Function1<number, Predicate<string>> = length => s => s.length >= length;
export const maxLength: Function1<number, Predicate<string>> = length => s => s.length <= length;
