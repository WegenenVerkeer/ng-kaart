import * as array from "fp-ts/lib/Array";
import { Refinement } from "fp-ts/lib/function";
import { Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";

export const isArray: Refinement<any, any[]> = Array.isArray;
export const isOfLength: (_: number) => <A>(_: A[]) => boolean = length => array => array.length === length;
export const hasLengthBetween: (_1: number, _2: number) => <A>(_: A[]) => boolean = (lower, upper) => array =>
  array.length >= lower && array.length <= upper;
export const isEmpty: <A>(_: A[]) => boolean = isOfLength(0);
export const isSingleton: <A>(_: A[]) => boolean = isOfLength(1);
export const isNonEmpty: <A>(_: A[]) => boolean = array => array.length > 0;
export const toArray: <A>(aOrAs: A | A[]) => A[] = aOrAs => (Array.isArray(aOrAs) ? aOrAs : [aOrAs]);

export const getElement: <A>(as: Array<A>) => (p: Predicate<A>) => (offset: number) => Option<A> = as => predicate => offset =>
  array.findIndex(as, predicate).chain(i => array.index(i + offset, as));

export const previousElement: <A>(as: Array<A>) => (p: Predicate<A>) => Option<A> = as => predicate => getElement(as)(predicate)(-1);

export const nextElement: <A>(as: Array<A>) => (p: Predicate<A>) => Option<A> = as => predicate => getElement(as)(predicate)(1);

export const insertAfter: <A>(as: Array<A>) => (p: Predicate<A>) => (a: A) => Option<Array<A>> = as => predicate => a =>
  array.findIndex(as, predicate).chain(i => array.insertAt(i + 1, a, as));

export const deleteFirst: <A>(as: Array<A>) => (p: Predicate<A>) => Option<Array<A>> = as => predicate =>
  array.findIndex(as, predicate).chain(i => array.deleteAt(i, as));
