import { Option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";

export function orElse<T>(anOption: Option<T>, anOtherOptionGen: () => Option<T>): Option<T> {
  return anOption.foldL(anOtherOptionGen, value => some(value));
}

export function forEach<T>(anOption: Option<T>, f: (t: T) => any): void {
  anOption.map(f);
}

export function contains(anOption: Option<String>, s: string): boolean {
  return anOption.contains(setoidString, s);
}
