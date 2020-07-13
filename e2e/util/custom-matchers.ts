/// <reference path="../types/custom-matchers/index.d.ts" />
import { option } from "fp-ts";

export const addOptionMatchers = () =>
  jasmine.addMatchers({
    toBeSome: () => ({
      compare: actual => {
        const pass = option.isSome(actual);
        return { pass: pass, message: pass ? "Ok" : `Expected '${actual}' to be defined` };
      }
    }),
    toBeNone: () => ({
      compare: actual => {
        const pass = option.isNone(actual);
        return { pass: pass, message: pass ? "Ok" : `Expected '${actual}' to not be defined` };
      }
    })
  });
