import { applicative, array, either, monad, option, semigroup } from "fp-ts";
import { getSemigroup } from "fp-ts/lib/NonEmptyArray";
import { Predicate, Refinement } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";

export type ErrValidation<A> = either.Either<string[], A>;
export type Validator<A, B> = (a: A) => ErrValidation<B>;

export const validationSemigroup = getSemigroup<string>();
export const validationAp: applicative.Applicative2C<
  either.URI,
  string[]
> = either.getApplicativeValidation(validationSemigroup);

export const allOf = array.sequence(validationAp);

export const success = <A>(a: A): ErrValidation<A> =>
  either.right<string[], A>(a);
export const failure = <A>(err: string): ErrValidation<A> =>
  either.left<string[], A>([err]);

export function fromOption<A>(
  maybe: option.Option<A>,
  errorMsg: string
): ErrValidation<A> {
  return pipe(
    maybe,
    option.map((t) => success(t)),
    option.getOrElse(() => failure(errorMsg))
  );
}

export function toOption<A>(validation: ErrValidation<A>): option.Option<A> {
  return pipe(
    validation,
    either.map(option.some),
    either.getOrElse(() => option.none)
  );
}

export function fromPredicate<A, B extends A>(
  a: A,
  pred: Refinement<A, B>,
  errMsg: string
): ErrValidation<B>;
export function fromPredicate<A>(
  a: A,
  pred: Predicate<A>,
  errMsg: string
): ErrValidation<A>;
export function fromPredicate<A>(
  a: A,
  pred: Predicate<A>,
  errMsg: string
): ErrValidation<A> {
  return either.fromPredicate(pred, () => [errMsg])(a);
}

export function fromBoolean(
  thruth: boolean,
  errMsg: string
): either.Either<string[], {}> {
  return thruth ? success({}) : failure(errMsg);
}

export const validationMonad = either.getValidation(validationSemigroup);

export const validationChain: <A, B>(
  fa: ErrValidation<A>,
  f: Validator<A, B>
) => ErrValidation<B> = validationMonad.chain;

export const validationChain2: <A, B, C>(
  fa: ErrValidation<A>,
  f: Validator<A, B>,
  g: Validator<B, C>
) => ErrValidation<C> = (fa, f, g) =>
  validationChain(validationChain(fa, f), g);

export function composeValidators2<A, B, C>(
  f: Validator<A, B>,
  g: Validator<B, C>
): Validator<A, C> {
  return (a: A) => validationChain(f(a), g);
}
