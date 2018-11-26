import { Predicate } from "fp-ts/lib/function";

export const isArray: Predicate<any> = Array.isArray;
export const isOfLength: (_: number) => <A>(_: A[]) => boolean = length => array => array.length === length;
export const hasLengthBetween: (_1: number, _2: number) => <A>(_: A[]) => boolean = (lower, upper) => array =>
  array.length >= lower && array.length <= upper;
export const isEmpty: <A>(_: A[]) => boolean = isOfLength(0);
export const isSingleton: <A>(_: A[]) => boolean = isOfLength(1);
export const isNonEmpty: <A>(_: A[]) => boolean = array => array.length > 0;
