import { option, ord } from "fp-ts";
import * as array from "fp-ts/lib/Array";
import { Either } from "fp-ts/lib/Either";
import { identity, pipe, Predicate, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";

import { PartialFunction1 } from "./function";

export const isArray: Refinement<any, any[]> = Array.isArray;
export const isOfLength: (_: number) => <A>(_: A[]) => boolean = length => array => array.length === length;
export const hasLengthBetween: (_1: number, _2: number) => <A>(_: A[]) => boolean = (lower, upper) => array =>
  array.length >= lower && array.length <= upper;
export const isEmpty: <A>(_: A[]) => boolean = isOfLength(0);
export const isSingleton: <A>(_: A[]) => boolean = isOfLength(1);
export const isNonEmpty: <A>(_: A[]) => boolean = array => array.length > 0;
export const hasAtLeastLength: (_: number) => <A>(_: A[]) => boolean = n => array => array.length >= n;
export const toArray: <A>(aOrAs: A | A[]) => A[] = aOrAs => (Array.isArray(aOrAs) ? aOrAs : [aOrAs]);

export const pure: <A>() => A[] = () => [];

const findOffsetElement: <A>(as: Array<A>) => (p: Predicate<A>) => (offset: number) => Option<A> = as => predicate => offset =>
  array.findIndex(as, predicate).chain(i => array.lookup(i + offset, as));

export const previousElement: <A>(as: Array<A>) => (p: Predicate<A>) => Option<A> = as => predicate => findOffsetElement(as)(predicate)(-1);

export const nextElement: <A>(as: Array<A>) => (p: Predicate<A>) => Option<A> = as => predicate => findOffsetElement(as)(predicate)(1);

export const insertAfter: <A>(as: Array<A>) => (p: Predicate<A>) => (a: A) => Option<Array<A>> = as => predicate => a =>
  array.findIndex(as, predicate).chain(i => array.insertAt(i + 1, a, as));

export const deleteFirst: <A>(as: Array<A>) => (p: Predicate<A>) => Option<Array<A>> = as => predicate =>
  array.findIndex(as, predicate).chain(i => array.deleteAt(i, as));

export const splitInChunks = <A>(as: Array<A>, aantalChunks: number): Array<Array<A>> => {
  const chunkSize = Math.ceil(as.length / aantalChunks);
  return array.chunksOf(as, chunkSize);
};

export const fromOption: <A>(maybeArray: Option<A[]>) => A[] = mas => mas.fold(pure(), identity);
export const fromEither: <L, A>(eitherArray: Either<L, A[]>) => A[] = pipe(
  option.fromEither,
  fromOption
);
export const fromNullable: <A>(aOrAs: null | undefined | A | A[]) => A[] = aOrAs => option.fromNullable(aOrAs).fold([], toArray);

/**
 * Finds the first element of an array according to some ordering.
 * @param order The Ord to use as a comparison
 */
export const findFirstBy: <A>(order: ord.Ord<A>) => PartialFunction1<A[], A> = order => as =>
  array.fold(as, option.none, (head, tail) =>
    findFirstBy(order)(tail)
      .map(first => (order.compare(head, first) < 0 ? head : first))
      .orElse(() => option.some(head))
  );
