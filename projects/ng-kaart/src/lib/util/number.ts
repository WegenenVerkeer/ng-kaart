import { Function1 } from "fp-ts/lib/function";
import { fromNullable, fromPredicate } from "fp-ts/lib/Option";

import { PartialFunction1 } from "./function";

const trimmed: Function1<any, any> = input => (typeof input === "string" ? input.trim() : input.toString());

// Het probleem is dat bijv. "5x4" geparsed wordt als 5
export const parseInteger: PartialFunction1<any, number> = input =>
  fromNullable(input).chain(i => fromPredicate((v: number) => Number.isSafeInteger(v) && v.toString() === trimmed(i))(parseInt(i, 10)));

export const parseDouble: PartialFunction1<any, number> = input =>
  fromNullable(input).chain(i => fromPredicate((v: number) => Number.isFinite(v) && v.toString() === trimmed(i))(parseFloat(i)));
