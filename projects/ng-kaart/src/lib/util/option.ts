import { either, eq, option, record } from "fp-ts";
import { Predicate } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";

import { isNotNullOrUndefined } from "./null";

export function forEach<T>(anOption: option.Option<T>, f: (t: T) => any): void {
  pipe(anOption, option.map(f));
}

export function fromValidation<L, A>(
  validation: either.Either<L, A>
): option.Option<A> {
  return pipe(
    validation,
    either.fold(() => option.none, option.some)
  );
}

export function fromNullablePredicate<A>(
  predicate: Predicate<A>,
  a: A
): option.Option<A> {
  return pipe(
    option.fromPredicate(predicate)(a),
    option.chain(option.fromNullable)
  );
}

export function toArray<A>(maybeA: option.Option<A>): A[] {
  return pipe(
    maybeA,
    option.fold(
      () => [],
      (a) => [a]
    )
  );
}

export type NoOption<A> = A extends option.Option<infer B> ? B | undefined : A;

export type NoOptionRecord<A> = { readonly [P in keyof A]: NoOption<A[P]> };

export function isOption<A>(v: unknown): v is option.Option<A> {
  return (
    isNotNullOrUndefined(v) &&
    typeof v === "object" &&
    ((v as any)._tag === "Some" || (v as any)._tag === "None")
  );
}

function valueToUndefined(v: unknown): unknown {
  return isOption(v) ? option.toUndefined(v) : v;
}

export function optionsToUndefined<A extends object>(a: A): NoOptionRecord<A> {
  return (record.map(valueToUndefined)(a) as unknown) as NoOptionRecord<A>;
}
