import { Refinement } from "fp-ts/es6/function";

export const isBoolean: Refinement<any, boolean> = (obj: any): obj is boolean =>
  typeof obj === "boolean";
