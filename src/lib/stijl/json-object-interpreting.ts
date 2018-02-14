import { Option, none, some, Some } from "fp-ts/lib/Option";
import { monoidString } from "fp-ts/lib/Monoid";
import * as array from "fp-ts/lib/Array";
import * as validation from "fp-ts/lib/Validation";
import * as traversable from "fp-ts/lib/Traversable";

// De error zou enkel voor ontwikkelaars mogen zijn. Als ook gebruikers vrij definities mogen opladen,
// dan zou een echte Validation beter zijn.

export type Error = string;
export type Validation<T> = validation.Validation<string, T>;
export type Interpreter<T> = (obj: Object) => Validation<T>;

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

export const bool: Interpreter<boolean> = (json: Object) => {
  if (typeof json === "boolean") {
    return ok(json as boolean);
  } else {
    return fail(`${toString(json)} is geen boolean  `);
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

export function required<T>(interpreter: Interpreter<T>): Interpreter<Option<T>> {
  return map<T, Option<T>>(some, interpreter);
}

export function optField<T>(name: string, interpreter: Interpreter<T>): Interpreter<Option<T>> {
  return (json: Object) => (json.hasOwnProperty(name) ? interpreter(json[name]).map(some) : ok(none));
}

export function arr<T>(interpreter: Interpreter<T>): Interpreter<Array<T>> {
  return (jsonArray: Object) => {
    if (!Array.isArray(jsonArray)) {
      return fail(`${toString(jsonArray)} is geen array`);
    } else {
      return array.reduce(
        (vts: Validation<Array<T>>, json: Object) => vts.chain(ts => interpreter(json).map(array.snoc(ts))),
        ok(new Array<T>()),
        jsonArray as Array<Object>
      );
    }
  };
}

export function map<A1, Value>(f: (a1: A1) => Value, interpreter: Interpreter<A1>): Interpreter<Value> {
  return (json: Object) => interpreter(json).map(f);
}

export function map2<A1, A2, Value>(
  f: (a1: A1, a2: A2) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>
): Interpreter<Value> {
  return (json: Object) => interpreter1(json).chain(a1 => interpreter2(json).map(a2 => f(a1, a2)));
}

export function map3<A1, A2, A3, Value>(
  f: (a1: A1, a2: A2, a3: A3) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>
): Interpreter<Value> {
  return (json: Object) => interpreter1(json).chain(a1 => interpreter2(json).chain(a2 => interpreter3(json).map(a3 => f(a1, a2, a3))));
}

export function map4<A1, A2, A3, A4, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>
): Interpreter<Value> {
  return (json: Object) =>
    map2((a1: A1, a2: A2) => [a1, a2], interpreter1, interpreter2)(json).chain(([a1, a2]: [A1, A2]) =>
      map2((a3: A3, a4: A4) => [a3, a4], interpreter3, interpreter4)(json).map(([a3, a4]: [A3, A4]) => f(a1, a2, a3, a4))
    );
}

export function map5<A1, A2, A3, A4, A5, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>,
  interpreter5: Interpreter<A5>
): Interpreter<Value> {
  return (json: Object) =>
    map2((a1: A1, a2: A2) => [a1, a2], interpreter1, interpreter2)(json).chain(([a1, a2]: [A1, A2]) =>
      map3((a3: A3, a4: A4, a5: A5) => [a3, a4, a5], interpreter3, interpreter4, interpreter5)(json).map(([a3, a4, a5]: [A3, A4, A5]) =>
        f(a1, a2, a3, a4, a5)
      )
    );
}

export function map6<A1, A2, A3, A4, A5, A6, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>,
  interpreter5: Interpreter<A5>,
  interpreter6: Interpreter<A6>
): Interpreter<Value> {
  return (json: Object) =>
    map3((a1: A1, a2: A2, a3: A3) => [a1, a2, a3], interpreter1, interpreter2, interpreter3)(json).chain(([a1, a2, a3]: [A1, A2, A3]) =>
      map3((a4: A4, a5: A5, a6: A6) => [a4, a5, a6], interpreter4, interpreter5, interpreter6)(json).map(([a4, a5, a6]: [A4, A5, A6]) =>
        f(a1, a2, a3, a4, a5, a6)
      )
    );
}

export function map7<A1, A2, A3, A4, A5, A6, A7, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>,
  interpreter5: Interpreter<A5>,
  interpreter6: Interpreter<A6>,
  interpreter7: Interpreter<A7>
): Interpreter<Value> {
  return (json: Object) =>
    map4((a1: A1, a2: A2, a3: A3, a4: A4) => [a1, a2, a3, a4], interpreter1, interpreter2, interpreter3, interpreter4)(json).chain(
      ([a1, a2, a3, a4]: [A1, A2, A3, A4]) =>
        map3((a5: A5, a6: A6, a7: A7) => [a5, a6, a7], interpreter5, interpreter6, interpreter7)(json).map(([a5, a6, a7]: [A5, A6, A7]) =>
          f(a1, a2, a3, a4, a5, a6, a7)
        )
    );
}

export function map8<A1, A2, A3, A4, A5, A6, A7, A8, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>,
  interpreter5: Interpreter<A5>,
  interpreter6: Interpreter<A6>,
  interpreter7: Interpreter<A7>,
  interpreter8: Interpreter<A8>
): Interpreter<Value> {
  return (json: Object) =>
    map4((a1: A1, a2: A2, a3: A3, a4: A4) => [a1, a2, a3, a4], interpreter1, interpreter2, interpreter3, interpreter4)(json).chain(
      ([a1, a2, a3, a4]: [A1, A2, A3, A4]) =>
        map4((a5: A5, a6: A6, a7: A7, a8: A8) => [a5, a6, a7, a8], interpreter5, interpreter6, interpreter7, interpreter8)(json).map(
          ([a5, a6, a7, a8]: [A5, A6, A7, A8]) => f(a1, a2, a3, a4, a5, a6, a7, a8)
        )
    );
}

export function map9<A1, A2, A3, A4, A5, A6, A7, A8, A9, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8, a9: A9) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>,
  interpreter5: Interpreter<A5>,
  interpreter6: Interpreter<A6>,
  interpreter7: Interpreter<A7>,
  interpreter8: Interpreter<A8>,
  interpreter9: Interpreter<A9>
): Interpreter<Value> {
  return (json: Object) =>
    map5(
      (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => [a1, a2, a3, a4, a5],
      interpreter1,
      interpreter2,
      interpreter3,
      interpreter4,
      interpreter5
    )(json).chain(([a1, a2, a3, a4, a5]: [A1, A2, A3, A4, A5]) =>
      map4((a6: A6, a7: A7, a8: A8, a9: A9) => [a6, a7, a8, a9], interpreter6, interpreter7, interpreter8, interpreter9)(json).map(
        ([a6, a7, a8, a9]: [A6, A7, A8, A9]) => f(a1, a2, a3, a4, a5, a6, a7, a8, a9)
      )
    );
}

export function map10<A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8, a9: A9, a10: A10) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>,
  interpreter5: Interpreter<A5>,
  interpreter6: Interpreter<A6>,
  interpreter7: Interpreter<A7>,
  interpreter8: Interpreter<A8>,
  interpreter9: Interpreter<A9>,
  interpreter10: Interpreter<A10>
): Interpreter<Value> {
  return (json: Object) =>
    map5(
      (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => [a1, a2, a3, a4, a5],
      interpreter1,
      interpreter2,
      interpreter3,
      interpreter4,
      interpreter5
    )(json).chain(([a1, a2, a3, a4, a5]: [A1, A2, A3, A4, A5]) =>
      map5(
        (a6: A6, a7: A7, a8: A8, a9: A9, a10: A10) => [a6, a7, a8, a9, a10],
        interpreter6,
        interpreter7,
        interpreter8,
        interpreter9,
        interpreter10
      )(json).map(([a6, a7, a8, a9, a10]: [A6, A7, A8, A9, A10]) => f(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10))
    );
}

export function map11<A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8, a9: A9, a10: A10, a11: A11) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>,
  interpreter5: Interpreter<A5>,
  interpreter6: Interpreter<A6>,
  interpreter7: Interpreter<A7>,
  interpreter8: Interpreter<A8>,
  interpreter9: Interpreter<A9>,
  interpreter10: Interpreter<A10>,
  interpreter11: Interpreter<A11>
): Interpreter<Value> {
  return (json: Object) =>
    map6(
      (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => [a1, a2, a3, a4, a5, a6],
      interpreter1,
      interpreter2,
      interpreter3,
      interpreter4,
      interpreter5,
      interpreter6
    )(json).chain(([a1, a2, a3, a4, a5, a6]: [A1, A2, A3, A4, A5, A6]) =>
      map5(
        (a7: A7, a8: A8, a9: A9, a10: A10, a11: A11) => [a7, a8, a9, a10, a11],
        interpreter7,
        interpreter8,
        interpreter9,
        interpreter10,
        interpreter11
      )(json).map(([a7, a8, a9, a10, a11]: [A7, A8, A9, A10, A11]) => f(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11))
    );
}

export function pure<T>(t: T): Interpreter<T> {
  return (json: Object) => ok(t);
}

export function andMap<A, B>(interpreterA: Interpreter<A>, interpreterFA: Interpreter<(a: A) => B>): Interpreter<B> {
  return (json: Object) => interpreterA(json).chain(a => interpreterFA(json).map(fa => fa(a)));
}

export const ap = <A, B>(interpreterFA: Interpreter<(a: A) => B>) => (interpreterA: Interpreter<A>): Interpreter<B> => (json: Object) =>
  interpreterA(json).chain(a => interpreterFA(json).map(fa => fa(a)));

export type InterpreterOptionalRecord<A> = { readonly [P in keyof A]: Interpreter<Option<A[P]>> };

function interpretRecord<A>(record: InterpreterOptionalRecord<A>): Interpreter<A> {
  return (json: Object) => {
    const result = {} as Partial<A>; // Omdat we overal undefined willen kunnen zetten
    const validations = new Array<Validation<any>>();
    // tslint:disable-next-line:forin
    for (const k in record) {
      const validationOutcome: Validation<Option<A[keyof A]>> = record[k](json);
      // zet alle resultaten waarvoor de validation ok is
      validationOutcome.map(maybeValue => (result[k] = maybeValue.toUndefined())); // forEach
      // combineer alle fails, map de ok's weg (probleem is dat die allemaal een ander type hebben)
      validations.push(validationOutcome.map(_ => {}));
    }
    // De gesequencete validation is ok als alle deelvalidations ok zijn
    return traversable
      .sequence(validation, array)(validations)
      .map(_ => result as A); // we hebben het echte resultaat al in de for loop gezet
  };
}

export function mapRecord<A, B>(f: (a: A) => B, record: InterpreterOptionalRecord<A>): Interpreter<B> {
  return map(f, interpretRecord(record));
}

// function toOlType<T>(interpreterRecord: InterpreterRecord<T>): Interpreter<T> {
//   return (json: object) =>
// }

export function toString(json: Object): string {
  return JSON.stringify(json);
}
