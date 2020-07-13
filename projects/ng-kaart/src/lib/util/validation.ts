import { applicative, array, monad, option, semigroup, traversable, validation } from "fp-ts";
import { Function1, Predicate, Refinement } from "fp-ts/lib/function";

export type ErrValidation<A> = validation.Validation<string[], A>;
export type Validator<A, B> = Function1<A, ErrValidation<B>>;

export const validationSemigroup = semigroup.getArraySemigroup<string>();
export const validationAp: applicative.Applicative2C<validation.URI, string[]> = validation.getApplicative(validationSemigroup);

export const allOf = traversable.sequence(validationAp, array.array);

export const success = <A>(a: A): ErrValidation<A> => validation.success<string[], A>(a);
export const failure = <A>(err: string): ErrValidation<A> => validation.failure<string[], A>([err]);

export function fromOption<A>(maybe: option.Option<A>, errorMsg: string): ErrValidation<A> {
  return maybe.map(t => validation.success<string[], A>(t)).getOrElse(validation.failure([errorMsg]));
}

export function toOption<A>(validation: ErrValidation<A>): option.Option<A> {
  return validation.map(option.some).getOrElse(option.none);
}

export function fromPredicate<A, B extends A>(a: A, pred: Refinement<A, B>, errMsg: string): ErrValidation<B>;
export function fromPredicate<A>(a: A, pred: Predicate<A>, errMsg: string): ErrValidation<A>;
export function fromPredicate<A>(a: A, pred: Predicate<A>, errMsg: string): ErrValidation<A> {
  return validation.fromPredicate(pred, () => [errMsg])(a);
}

export function fromBoolean(thruth: boolean, errMsg: string): validation.Validation<string[], {}> {
  return thruth ? validation.success({}) : validation.failure([errMsg]);
}

export const validationMonad: monad.Monad2C<validation.URI, string[]> = validation.getMonad(semigroup.getArraySemigroup<string>());

export const validationChain: <A, B>(fa: ErrValidation<A>, f: Validator<A, B>) => ErrValidation<B> = validationMonad.chain;

export const validationChain2: <A, B, C>(fa: ErrValidation<A>, f: Validator<A, B>, g: Validator<B, C>) => ErrValidation<C> = (fa, f, g) =>
  validationChain(validationChain(fa, f), g);

export function composeValidators2<A, B, C>(f: Validator<A, B>, g: Validator<B, C>): Validator<A, C> {
  return (a: A) => validationChain(f(a), g);
}
