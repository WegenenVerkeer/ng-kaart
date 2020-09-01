import { option } from "fp-ts";
import { Refinement } from "fp-ts/es6/function";
import { Function1 } from "fp-ts/lib/function";

import { PartialFunction1 } from "./function";

const trimmed: Function1<any, any> = (input) =>
  typeof input === "string" ? input.trim() : input.toString();

// Het probleem is dat bijv. "5x4" geparsed wordt als 5
export const parseInteger: PartialFunction1<any, number> = (input) =>
  option
    .fromNullable(input)
    .chain((i) =>
      option.fromPredicate(
        (v: number) => Number.isSafeInteger(v) && v.toString() === trimmed(i)
      )(parseInt(i, 10))
    );

export const parseDouble: PartialFunction1<any, number> = (input) =>
  option
    .fromNullable(input)
    .chain((i) =>
      option.fromPredicate(
        (v: number) => Number.isFinite(v) && v.toString() === trimmed(i)
      )(parseFloat(i))
    );

export const isNumber: Refinement<any, number> = (obj: any): obj is number =>
  typeof obj === "number";
