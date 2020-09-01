import { Curried2, Function1, Lazy } from "fp-ts/lib/function";

import { Key, Kinded } from "./kinded";

export type FallbackMatcher<A, B, K extends Key = string> = {
  readonly [P in K]?: Function1<A, B>;
} & { readonly fallback: Lazy<B> };

export function matchWithFallback<A, B, K extends Key = string>(
  mapper: FallbackMatcher<A, B, K>
): Curried2<Function1<A, K>, A, B> {
  return (f) => (a) => {
    const mapping = mapper[f(a)];
    return mapping ? mapping(a) : mapper.fallback();
  };
}

export type FullMatcher<A, B, K extends Key = string> = {
  readonly [P in K]: Function1<A, B>;
};

export function match<A, B, K extends Key = string>(
  mapper: FullMatcher<A, B, K>
): Curried2<Function1<A, K>, A, B> {
  return (f) => (a) => mapper[f(a)](a);
}

export type Project<
  T extends Kinded<Ke>,
  K extends T["kind"],
  Ke extends Key = string
> = T & { kind: K };

export type FullKindMatcher<
  A extends Kinded<K>,
  B,
  K extends Key = A["kind"]
> = {
  readonly [P in A["kind"]]: Function1<Project<A, P, K>, B>;
};

export function matchKind<A extends Kinded<K>, B, K extends Key = A["kind"]>(
  mapper: FullKindMatcher<A, B, K>
): Function1<A, B> {
  return (a) => mapper[a.kind](a);
}
