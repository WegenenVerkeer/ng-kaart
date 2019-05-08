import { Curried2, Function1, Lazy } from "fp-ts/lib/function";

export type Key = string | number | symbol;

export type FallbackMatcher<A, B, K extends Key> = { readonly [P in K]?: Function1<A, B> } & { readonly fallback: Lazy<B> };

export function matchWithFallback<A, B, K extends Key>(mapper: FallbackMatcher<A, B, K>): Curried2<Function1<A, K>, A, B> {
  return f => a => {
    const mapping = mapper[f(a)];
    return mapping ? mapping(a) : mapper.fallback();
  };
}

export type FullMatcher<A, B, K extends Key> = {
  readonly [P in K]: Function1<A, B>
  // readonly [P in TypeType]: Function1<TypeType & { readonly kind: P; readonly [key: string]: any }, A>
};

export function match<A, B, K extends Key>(mapper: FullMatcher<A, B, K>): Curried2<Function1<A, K>, A, B> {
  return f => a => mapper[f(a)](a);
}
