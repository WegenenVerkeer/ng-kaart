import { Refinement } from "fp-ts/lib/function";

export type Key = string | number | symbol;

export interface Kinded<K extends Key> {
  readonly kind: K;
}

export function isOfKind<K extends Key, A extends Kinded<K>, B extends A, Kind extends B["kind"]>(kind: Kind): Refinement<A, B> {
  return (b): b is B => b.kind === kind;
}
