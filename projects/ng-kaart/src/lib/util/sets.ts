import { set } from "fp-ts";
import { pipe } from "fp-ts/lib/function";

export const isOfSize: (_: number) => <A>(_: Set<A>) => boolean = (size) => (
  set
) => set.size === size;

export const isEmpty: <A>(_: Set<A>) => boolean = isOfSize(0);

export const isNonEmpty: <A>(_: Set<A>) => boolean = (set) => set.size > 0;

export const removeSimple: <A>(as: Set<A>) => (a: A) => Set<A> = (as) => (
  a
) => {
  return pipe(
    as,
    set.filter((elem) => elem !== a)
  );
};
