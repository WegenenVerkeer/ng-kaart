import { array, either, eq, option, ord } from "fp-ts";
import {
  flow,
  identity,
  pipe,
  Predicate,
  Refinement,
} from "fp-ts/lib/function";

import { PartialFunction1 } from "./function";

export const isArray: Refinement<any, any[]> = Array.isArray;
export const isOfLength: (_: number) => <A>(_: A[]) => boolean = (length) => (
  array
) => array.length === length;
export const hasLengthBetween: (
  _1: number,
  _2: number
) => <A>(_: A[]) => boolean = (lower, upper) => (array) =>
  array.length >= lower && array.length <= upper;
export const isEmpty: <A>(as: A[]) => boolean = isOfLength(0);
export const isSingleton: <A>(_: A[]) => boolean = isOfLength(1);
export const isNonEmpty: <A>(_: A[]) => boolean = (array) => array.length > 0;
export const hasAtLeastLength: (_: number) => <A>(_: A[]) => boolean = (n) => (
  array
) => array.length >= n;
export const toArray: <A>(aOrAs: A | A[]) => A[] = (aOrAs) =>
  Array.isArray(aOrAs) ? aOrAs : [aOrAs];
export const length: <A>(as: A[]) => number = (as) => as.length;

export const pure: <A>() => A[] = () => [];

const findOffsetElement: <A>(
  as: Array<A>
) => (p: Predicate<A>) => (offset: number) => option.Option<A> = (as) => (
  predicate
) => (offset) =>
  pipe(
    as,
    array.findIndex(predicate),
    option.chain((i) => array.lookup(i + offset, as))
  );

export const previousElement: <A>(
  as: Array<A>
) => (p: Predicate<A>) => option.Option<A> = (as) => (predicate) =>
  findOffsetElement(as)(predicate)(-1);

export const nextElement: <A>(
  as: Array<A>
) => (p: Predicate<A>) => option.Option<A> = (as) => (predicate) =>
  findOffsetElement(as)(predicate)(1);

export const insertAfter: <A>(
  as: Array<A>
) => (p: Predicate<A>) => (a: A) => option.Option<Array<A>> = (as) => (
  predicate
) => (a) =>
  pipe(
    as,
    array.findIndex(predicate),
    option.chain((i) => array.insertAt(i + 1, a)(as))
  );

export const deleteFirst: <A>(
  as: Array<A>
) => (p: Predicate<A>) => option.Option<Array<A>> = (as) => (predicate) =>
  pipe(
    as,
    array.findIndex(predicate),
    option.chain((i) => array.deleteAt(i)(as))
  );

export const splitInChunks = <A>(
  as: Array<A>,
  aantalChunks: number
): Array<Array<A>> => {
  const chunkSize = Math.ceil(as.length / aantalChunks);
  return array.chunksOf(chunkSize)(as);
};

export const fromOption: <A>(maybeArray: option.Option<A[]>) => A[] = (mas) =>
  pipe(
    mas,
    option.fold(() => pure(), identity)
  );
export const fromEither: <L, A>(
  eitherArray: either.Either<L, A[]>
) => A[] = flow(option.fromEither, fromOption);
export const fromNullable: <A>(aOrAs: null | undefined | A | A[]) => A[] = (
  aOrAs
) =>
  pipe(
    option.fromNullable(aOrAs),
    option.fold(() => [], toArray)
  );

/**
 * Finds the first element of an array according to option.some ordering.
 * @param order The Ord to use as a comparison
 */
export const findFirstBy: <A>(order: ord.Ord<A>) => PartialFunction1<A[], A> = (
  order
) => (as) =>
  pipe(
    as,
    array.foldLeft(
      () => option.none,
      (head, tail) =>
        pipe(
          findFirstBy(order)(tail),
          option.map((first) =>
            order.compare(head, first) < 0 ? head : first
          ),
          option.alt(() => option.some(head))
        )
    )
  );

/**
 * True if at least one array element satisfies the predicate. Thin wrapper around the standard library function that is
 * more composable.
 * @param pred The predicate to apply to the array elements.
 */
export const exists: <A>(pred: Predicate<A>) => Predicate<A[]> = (pred) => (
  as
) => as.some(pred);

/**
 * True iff the predicatie holds for all elements of the array.
 */
export const forAll: <A>(pred: Predicate<A>) => (as: A[]) => boolean = (pred) =>
  array.foldLeft(
    () => true,
    (head, tail) => pred(head) && forAll(pred)(tail)
  );

/**
 * True iff the first array contains all elements of the second array.
 */
export const containsAll = <A>(eq: eq.Eq<A>) => (as: A[], bs: A[]): boolean =>
  forAll((b: A) => array.elem(eq)(b, as))(bs);

export const getStringsSetoid: eq.Eq<string[]> = array.getEq(eq.eqString);

export const isOneOf = <A>(...as: A[]) => (a: A): boolean =>
  array.elem(eq.fromEquals(eq.strictEqual))(a, as);

export const asSingleton = <A>(as: A[]): option.Option<A[]> =>
  as.length === 1 ? option.some(as) : option.none;
