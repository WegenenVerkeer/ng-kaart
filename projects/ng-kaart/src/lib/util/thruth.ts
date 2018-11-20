import { Endomorphism } from "fp-ts/lib/function";

/**
 * Een function die zijn input inverteert.
 */
export const negate: Endomorphism<boolean> = b => !b;
