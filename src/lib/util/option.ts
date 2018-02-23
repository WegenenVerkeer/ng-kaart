import { Option, some } from "fp-ts/lib/Option";

export function orElse<T>(anOption: Option<T>, anOtherOptionGen: () => Option<T>) {
  return anOption.fold(anOtherOptionGen, value => some(value));
}
