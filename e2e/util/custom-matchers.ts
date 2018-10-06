import { isNone, isSome } from "fp-ts/lib/Option";

export const addOptionMatchers = () =>
  jasmine.addMatchers({
    toBeSome: () => ({
      compare: actual => {
        const pass = isSome(actual);
        return { pass: pass, message: pass ? "Ok" : `Expected '${actual}' to be defined` };
      }
    }),
    toBeNone: () => ({
      compare: actual => {
        const pass = isNone(actual);
        return { pass: pass, message: pass ? "Ok" : `Expected '${actual}' to not be defined` };
      }
    })
  });
