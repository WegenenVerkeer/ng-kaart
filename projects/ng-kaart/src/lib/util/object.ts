import { Refinement } from "fp-ts/es6/function";

export const isObject: Refinement<any, object> = (obj: any): obj is object => typeof obj === "object";
