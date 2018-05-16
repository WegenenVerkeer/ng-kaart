import { Either, left, right } from "fp-ts/lib/Either";

/**
 * Elk commando leidt tot een resultaat
 */
export type Result<Bad, Good> = Either<Bad, Good>;

export function ok<E, T>(t: T): Result<E, T> {
  return right(t);
}

export function err<E, T>(e: E): Result<E, T> {
  return left(e);
}
