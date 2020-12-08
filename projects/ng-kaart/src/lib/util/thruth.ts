import { Endomorphism } from "fp-ts/lib/function";

/**
 * Een function die zijn input inverteert.
 */
export const negate: Endomorphism<boolean> = (b) => !b;

/**
 * functievorm van and
 */
export function allTrue(b: boolean, ...bs: boolean[]): boolean {
  return bs.reduce((s, b) => s && b, b);
}
/**
 * functievorm van or
 */
export function atLeastOneTrue(b: boolean, ...bs: boolean[]): boolean {
  return bs.reduce((s, b) => s || b, b);
}
