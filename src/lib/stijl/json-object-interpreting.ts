import { Option, none, some } from "fp-ts/lib/Option";
import { monoidString } from "fp-ts/lib/Monoid";
import * as array from "fp-ts/lib/Array";
import * as validation from "fp-ts/lib/Validation";
import * as traversable from "fp-ts/lib/Traversable";

// De error zou enkel voor ontwikkelaars mogen zijn. Als ook gebruikers vrij definities mogen opladen,
// dan zou een echte Validation beter zijn.

export type Error = string;
export type Validation<T> = validation.Validation<string, T>;
export type Interpreter<T> = (obj: Object) => validation.Validation<string, T>;

///////////////////////////////////
// Basis functies
//

const failure = [
  validation.success<string, number>(1),
  validation.failure(monoidString)("[fail 1]"),
  validation.failure(monoidString)("[fail 2]")
];

export const fail = <T>(error: Error) => validation.failure(monoidString)<T>(error);
export const ok = <T>(style: T) => validation.success<Error, T>(style);

export const str: Interpreter<string> = (json: Object) => {
  if (typeof json === "string") {
    return ok(json as string);
  } else {
    return fail(`${toString(json)} is geen string`);
  }
};

export const num: Interpreter<number> = (json: Object) => {
  if (typeof json === "number") {
    return ok(json as number);
  } else {
    return fail(`${toString(json)} is geen number`);
  }
};

export function field<T>(name: string, interpreter: Interpreter<T>): Interpreter<T> {
  return (json: Object) => (json.hasOwnProperty(name) ? interpreter(json[name]) : fail(`'${toString(json)}' heeft geen veld '${name}'`));
}

export function at<T>(nest: Array<string>, interpreter: Interpreter<T>): Interpreter<T> {
  return array.fold(
    () => interpreter, //
    (head, tail) => at(tail, field(head, interpreter)),
    array.reverse(nest)
  );
}

export function option<T>(interpreter: Interpreter<T>): Interpreter<Option<T>> {
  return (json: Object) =>
    interpreter(json).fold(
      (bad: string) => {
        if (bad.includes(" heeft geen veld ")) {
          // breekbaar, met constanten werken of error type uitbreiden
          return ok(none);
        } else {
          return fail(bad);
        }
      },
      (good: T) => ok(some(good))
    );
}

export function map<A, Value>(f: (a: A) => Value, interpreter: Interpreter<A>): Interpreter<Value> {
  return (json: Object) => interpreter(json).map(f);
}

export function map2<A, B, Value>(
  f: (a: A, b: B) => Value,
  interpreter1: Interpreter<A>,
  interpreter2: Interpreter<B>
): Interpreter<Value> {
  return (json: Object) => interpreter1(json).chain(a => interpreter2(json).map(b => f(a, b)));
}

export function map3<A, B, C, Value>(
  f: (a: A, b: B, c: C) => Value,
  interpreter1: Interpreter<A>,
  interpreter2: Interpreter<B>,
  interpreter3: Interpreter<C>
): Interpreter<Value> {
  return (json: Object) => interpreter1(json).chain(a => interpreter2(json).chain(b => interpreter3(json).map(c => f(a, b, c))));
}

export function toString(json: Object): string {
  return JSON.stringify(json);
}
