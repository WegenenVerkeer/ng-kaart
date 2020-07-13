import { either } from "fp-ts";

/**
 * Elk commando leidt tot een resultaat
 */
export type Result<Bad, Good> = either.Either<Bad, Good>;

export function ok<E, T>(t: T): Result<E, T> {
  return either.right(t);
}

export function err<E, T>(e: E): Result<E, T> {
  return either.left(e);
}
