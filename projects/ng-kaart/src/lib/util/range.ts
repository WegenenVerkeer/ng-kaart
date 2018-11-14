import { Function3 } from "fp-ts/lib/function";

export const rangeIter: (_1: number, _2?: number, _3?: number) => Iterable<number> = (size, start?, step?) => ({
  *[Symbol.iterator]() {
    let n = 0;
    for (let i = start || 0; n < size; i += step || 1) {
      n += 1;
      yield i;
    }
    return n;
  }
});

export const rangeArray: (_1: number, _2?: number, _3?: number) => Array<number> = (size, start?, step?) =>
  Array.from(Array(size).keys()).map(i => i * (step || 1) + (start || 0));
