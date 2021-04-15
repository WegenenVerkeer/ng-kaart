import { array, either, option, traversable } from "fp-ts";
import { identity, Refinement } from "fp-ts/lib/function";
import { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import { pipe } from "fp-ts/lib/function";

import { kaartLogger } from "../kaart/log";
import {
  failure,
  success,
  validationAp,
  validationChain,
  validationSemigroup,
} from "../util/validation";

export type Error = string;
export type Validation<T> = either.Either<Error[], T>;
export type Interpreter<T> = (obj: Object) => Validation<T>;

/// ////////////////////////////////
// Basis functies
//

export const fail = failure;
export const ok = success;

export const str: Interpreter<string> = (json: Object) => {
  // noinspection SuspiciousTypeOfGuard
  if (typeof json === "string") {
    return ok(json as string);
  } else {
    return fail(`${toString(json)} is geen string`);
  }
};

export const num: Interpreter<number> = (json: Object) => {
  // noinspection SuspiciousTypeOfGuard
  if (typeof json === "number") {
    return ok(json as number);
  } else {
    return fail(`${toString(json)} is geen number`);
  }
};

export const bool: Interpreter<boolean> = (json: Object) => {
  // noinspection SuspiciousTypeOfGuard
  if (typeof json === "boolean") {
    return ok(json as boolean);
  } else {
    return fail(`${toString(json)} is geen boolean  `);
  }
};

export function field<T>(
  name: string,
  interpreter: Interpreter<T>
): Interpreter<T> {
  return (json: Object) =>
    json.hasOwnProperty(name)
      ? interpreter(json[name])
      : fail(`'${toString(json)}' heeft geen veld '${name}'`);
}

export function optional<T>(
  interpreter: Interpreter<T>
): Interpreter<option.Option<T>> {
  return firstOf(
    map<T, option.Option<T>>(option.fromNullable, interpreter),
    succeed(option.none)
  );
}

export function nullable<T>(
  interpreter: Interpreter<T>
): Interpreter<T | undefined> {
  return firstOf(interpreter, succeed(undefined));
}

export function at<T>(
  nest: Array<string>,
  interpreter: Interpreter<T>
): Interpreter<T> {
  return pipe(
    array.reverse(nest),
    array.foldLeft(
      () => interpreter,
      (head, tail) => at(tail, field(head, interpreter))
    )
  );
}

export function reqField<T>(
  name: string,
  interpreter: Interpreter<T>
): Interpreter<option.Option<T>> {
  return map<T, option.Option<T>>(option.some, field(name, interpreter));
}

export function optField<T>(
  name: string,
  interpreter: Interpreter<T>
): Interpreter<option.Option<T>> {
  // Kan ook met een fold op field, maar gezien deze methode meer gebruikt wordt en de velden doorgaans undefined zijn, is dit effciënter.
  return (json: Object) =>
    json.hasOwnProperty(name) && json[name] !== undefined
      ? pipe(interpreter(json[name]), either.map(option.some))
      : ok(option.none);
}

export function undefField<T>(
  name: string,
  interpreter: Interpreter<T>
): Interpreter<T | undefined> {
  // Het kan gebeuren dat de json velden wel gezet heeft, maar dat die op undefined staan
  return (json: Object) =>
    json.hasOwnProperty(name) && json[name] !== undefined
      ? interpreter(json[name])
      : ok(undefined);
}

export function succeed<T>(t: T): Interpreter<T> {
  return () => ok(t);
}

export function failed<T>(errMsg: string): Interpreter<T> {
  return () => fail(errMsg);
}

function validateArray<T>(
  jsonArray: Array<T>,
  interpreter: Interpreter<T>
): Validation<Array<T>> {
  return array.array.reduce(
    jsonArray as Array<Object>, //
    ok(new Array<T>()),
    (vts: Validation<Array<T>>, json: Object) =>
      validationChain(vts, (ts) =>
        pipe(
          interpreter(json),
          either.map((t) => array.snoc(ts, t))
        )
      )
  );
}

export function arr<T>(interpreter: Interpreter<T>): Interpreter<Array<T>> {
  return (jsonArray: Object) => {
    if (!Array.isArray(jsonArray)) {
      return fail(`${toString(jsonArray)} is geen array`);
    } else {
      return validateArray(jsonArray, interpreter);
    }
  };
}

export function arrSize<T>(
  size: number,
  interpreter: Interpreter<T>
): Interpreter<Array<T>> {
  return (jsonArray: Object) => {
    if (!Array.isArray(jsonArray)) {
      return fail(`${toString(jsonArray)} is geen array`);
    } else if (jsonArray.length !== size) {
      return fail(
        `${toString(jsonArray)} heeft niet precies ${size} elementen`
      );
    } else {
      return validateArray(jsonArray, interpreter);
    }
  };
}

export function enu<T extends string>(...values: T[]): Interpreter<T> {
  return (json: Object) =>
    validationChain(str(json), (jsonString) =>
      (values as string[]).indexOf(jsonString) < 0 //
        ? fail(`'${jsonString}' is niet één van '${values}'`)
        : ok(jsonString as T)
    );
}

/**
 * Selecteert de eerste interpreter die een niet-none resultaat oplevert. Indien geen enkele interpreter een niet-none resultaat oplevert,
 * is het resultaat none. Geen enkele van de interpreters mag een failure geven.
 */
export function atMostOneOf<T>(
  ...interpreters: Interpreter<option.Option<T>>[]
): Interpreter<option.Option<T>> {
  return (json: Object) => {
    const validations: Validation<Array<option.Option<T>>> = sequence(
      interpreters.map((i) => i(json))
    );
    const presentValidations: Validation<Array<T>> = pipe(
      validations,
      either.map(array.compact)
    );
    return validationChain(presentValidations, (values) => {
      switch (values.length) {
        case 0:
          return ok(option.none);
        case 1:
          return ok(array.head(values));
        default:
          return fail("Er mag maar 1 waarde aanwezig zijn");
      }
    });
  };
}

/**
 * Selecteert de eerste interpreter die een defined resultaat oplevert. Indien geen enkele interpreter een defined resultaat oplevert,
 * is het resultaat undefined. Geen enkele van de interpreters mag een failure geven.
 */
export function atMostOneDefined<T>(
  ...interpreters: Interpreter<T | undefined>[]
): Interpreter<T | undefined> {
  return (json: Object) => {
    const validations: Validation<Array<T | undefined>> = sequence(
      interpreters.map((i) => i(json))
    );
    const isDefined: Refinement<T | undefined, T> = (t): t is T =>
      t !== undefined;
    const presentValidations: Validation<Array<T>> = pipe(
      validations,
      either.map((vals) => pipe(vals, array.filter(isDefined)))
    );
    return validationChain(presentValidations, (values) => {
      switch (values.length) {
        case 0:
          return ok(undefined);
        case 1:
          return ok(values[0]);
        default:
          return fail("Er mag maar 1 waarde aanwezig zijn");
      }
    });
  };
}

/**
 * Probeert de interpreters tot er één een succesvolle validatie oplevert. Faalt als er zo geen gevonden kan worden.
 */
export function firstOf<T>(...interpreters: Interpreter<T>[]): Interpreter<T> {
  return (json: Object) => {
    return interpreters.reduce(
      (validation, interpreter) =>
        pipe(
          validation,
          either.fold(
            (allMsgs: NonEmptyArray<string>) =>
              pipe(
                interpreter(json),
                either.mapLeft((msgs: NonEmptyArray<string>) =>
                  validationSemigroup.concat(allMsgs, msgs)
                )
              ), // foutboodschappen verzamelen
            success
          )
        ),
      fail<T>("Er moet 1 waarde aanwezig zijn")
    );
  };
}

export function logger<T>(interpreter: Interpreter<T>): Interpreter<T> {
  return (json: object) => {
    kaartLogger.debug("object in", json);
    kaartLogger.debug("object out", interpreter(json));
    return interpreter(json);
  };
}

export function map<A1, Value>(
  f: (a1: A1) => Value,
  interpreter: Interpreter<A1>
): Interpreter<Value> {
  return (json: Object) => pipe(interpreter(json), either.map(f));
}

export function map2<A1, A2, Value>(
  f: (a1: A1, a2: A2) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>
): Interpreter<Value> {
  return (json: Object) =>
    validationChain(interpreter1(json), (a1) =>
      pipe(
        interpreter2(json),
        either.map((a2) => f(a1, a2))
      )
    );
}

export function map3<A1, A2, A3, Value>(
  f: (a1: A1, a2: A2, a3: A3) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>
): Interpreter<Value> {
  return (json: Object) =>
    validationChain(interpreter1(json), (a1) =>
      validationChain(interpreter2(json), (a2) =>
        pipe(
          interpreter3(json),
          either.map((a3) => f(a1, a2, a3))
        )
      )
    );
}

export function map4<A1, A2, A3, A4, Value>(
  f: (a1: A1, a2: A2, a3: A3, a4: A4) => Value,
  interpreter1: Interpreter<A1>,
  interpreter2: Interpreter<A2>,
  interpreter3: Interpreter<A3>,
  interpreter4: Interpreter<A4>
): Interpreter<Value> {
  return (json: Object) =>
    validationChain(
      map2((a1: A1, a2: A2) => [a1, a2], interpreter1, interpreter2)(json),
      ([a1, a2]: [A1, A2]) =>
        pipe(
          map2((a3: A3, a4: A4) => [a3, a4], interpreter3, interpreter4)(json),
          either.map(([a3, a4]: [A3, A4]) => f(a1, a2, a3, a4))
        )
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
    validationChain(
      map2((a1: A1, a2: A2) => [a1, a2], interpreter1, interpreter2)(json),
      ([a1, a2]: [A1, A2]) =>
        pipe(
          map3(
            (a3: A3, a4: A4, a5: A5) => [a3, a4, a5],
            interpreter3,
            interpreter4,
            interpreter5
          )(json),
          either.map(([a3, a4, a5]: [A3, A4, A5]) => f(a1, a2, a3, a4, a5))
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
    validationChain(
      map3(
        (a1: A1, a2: A2, a3: A3) => [a1, a2, a3],
        interpreter1,
        interpreter2,
        interpreter3
      )(json),
      ([a1, a2, a3]: [A1, A2, A3]) =>
        pipe(
          map3(
            (a4: A4, a5: A5, a6: A6) => [a4, a5, a6],
            interpreter4,
            interpreter5,
            interpreter6
          )(json),
          either.map(([a4, a5, a6]: [A4, A5, A6]) => f(a1, a2, a3, a4, a5, a6))
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
    validationChain(
      map4(
        (a1: A1, a2: A2, a3: A3, a4: A4) => [a1, a2, a3, a4],
        interpreter1,
        interpreter2,
        interpreter3,
        interpreter4
      )(json),
      ([a1, a2, a3, a4]: [A1, A2, A3, A4]) =>
        pipe(
          map3(
            (a5: A5, a6: A6, a7: A7) => [a5, a6, a7],
            interpreter5,
            interpreter6,
            interpreter7
          )(json),
          either.map(([a5, a6, a7]: [A5, A6, A7]) =>
            f(a1, a2, a3, a4, a5, a6, a7)
          )
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
    validationChain(
      map4(
        (a1: A1, a2: A2, a3: A3, a4: A4) => [a1, a2, a3, a4],
        interpreter1,
        interpreter2,
        interpreter3,
        interpreter4
      )(json),
      ([a1, a2, a3, a4]: [A1, A2, A3, A4]) =>
        pipe(
          map4(
            (a5: A5, a6: A6, a7: A7, a8: A8) => [a5, a6, a7, a8],
            interpreter5,
            interpreter6,
            interpreter7,
            interpreter8
          )(json),
          either.map(([a5, a6, a7, a8]: [A5, A6, A7, A8]) =>
            f(a1, a2, a3, a4, a5, a6, a7, a8)
          )
        )
    );
}

export function map9<A1, A2, A3, A4, A5, A6, A7, A8, A9, Value>(
  f: (
    a1: A1,
    a2: A2,
    a3: A3,
    a4: A4,
    a5: A5,
    a6: A6,
    a7: A7,
    a8: A8,
    a9: A9
  ) => Value,
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
    validationChain(
      map5(
        (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => [a1, a2, a3, a4, a5],
        interpreter1,
        interpreter2,
        interpreter3,
        interpreter4,
        interpreter5
      )(json),
      ([a1, a2, a3, a4, a5]: [A1, A2, A3, A4, A5]) =>
        pipe(
          map4(
            (a6: A6, a7: A7, a8: A8, a9: A9) => [a6, a7, a8, a9],
            interpreter6,
            interpreter7,
            interpreter8,
            interpreter9
          )(json),
          either.map(([a6, a7, a8, a9]: [A6, A7, A8, A9]) =>
            f(a1, a2, a3, a4, a5, a6, a7, a8, a9)
          )
        )
    );
}

export function map10<A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, Value>(
  f: (
    a1: A1,
    a2: A2,
    a3: A3,
    a4: A4,
    a5: A5,
    a6: A6,
    a7: A7,
    a8: A8,
    a9: A9,
    a10: A10
  ) => Value,
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
    validationChain(
      map5(
        (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => [a1, a2, a3, a4, a5],
        interpreter1,
        interpreter2,
        interpreter3,
        interpreter4,
        interpreter5
      )(json),
      ([a1, a2, a3, a4, a5]: [A1, A2, A3, A4, A5]) =>
        pipe(
          map5(
            (a6: A6, a7: A7, a8: A8, a9: A9, a10: A10) => [a6, a7, a8, a9, a10],
            interpreter6,
            interpreter7,
            interpreter8,
            interpreter9,
            interpreter10
          )(json),
          either.map(([a6, a7, a8, a9, a10]: [A6, A7, A8, A9, A10]) =>
            f(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
          )
        )
    );
}

export function map11<A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, Value>(
  f: (
    a1: A1,
    a2: A2,
    a3: A3,
    a4: A4,
    a5: A5,
    a6: A6,
    a7: A7,
    a8: A8,
    a9: A9,
    a10: A10,
    a11: A11
  ) => Value,
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
    validationChain(
      map6(
        (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => [
          a1,
          a2,
          a3,
          a4,
          a5,
          a6,
        ],
        interpreter1,
        interpreter2,
        interpreter3,
        interpreter4,
        interpreter5,
        interpreter6
      )(json),
      ([a1, a2, a3, a4, a5, a6]: [A1, A2, A3, A4, A5, A6]) =>
        pipe(
          map5(
            (a7: A7, a8: A8, a9: A9, a10: A10, a11: A11) => [
              a7,
              a8,
              a9,
              a10,
              a11,
            ],
            interpreter7,
            interpreter8,
            interpreter9,
            interpreter10,
            interpreter11
          )(json),
          either.map(([a7, a8, a9, a10, a11]: [A7, A8, A9, A10, A11]) =>
            f(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11)
          )
        )
    );
}

export function pure<T>(t: T): Interpreter<T> {
  return () => ok(t);
}

export function andMap<A, B>(
  interpreterA: Interpreter<A>,
  interpreterFA: Interpreter<(a: A) => B>
): Interpreter<B> {
  return (json: Object) =>
    validationAp.ap(interpreterFA(json), interpreterA(json));
}

export const ap = <A, B>(interpreterFA: Interpreter<(a: A) => B>) => (
  interpreterA: Interpreter<A>
): Interpreter<B> => (json: Object) =>
  validationAp.ap<A, B>(interpreterFA(json), interpreterA(json));

export const chain = <A, B>(
  interpreterA: Interpreter<A>,
  fa: (a: A) => Interpreter<B>
): Interpreter<B> => (json: Object) =>
  validationChain(interpreterA(json), (a) => fa(a)(json));

export const injectFirst = <A>(
  extraJson: Object,
  interpreterA: Interpreter<A>
): Interpreter<A> => (json: Object) => interpreterA(mergeDeep(extraJson, json));

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function mergeDeep<T>(base: T, overlay: T) {
  const output = Object.assign({}, base);
  if (isObject(base) && isObject(overlay)) {
    Object.keys(overlay).forEach((overlayKey) => {
      if (isObject(overlay[overlayKey])) {
        if (!(overlayKey in base)) {
          Object.assign(output, { [overlayKey]: overlay[overlayKey] });
        } else {
          output[overlayKey] = mergeDeep(base[overlayKey], overlay[overlayKey]);
        }
      } else {
        Object.assign(output, { [overlayKey]: overlay[overlayKey] });
      }
    });
  }
  return output;
}

// Een afgeleid type van A dat alle types van de  velden omzet in Interpreters van Options van dat type
export type InterpreterOptionalRecord<A> = {
  readonly [P in Extract<keyof A, string>]: Interpreter<option.Option<A[P]>>;
};

function interpretOptionalRecord<A>(
  record: InterpreterOptionalRecord<A>
): Interpreter<A> {
  return (json: Object) => {
    const result = {} as Partial<A>; // Omdat we overal undefined willen kunnen zetten
    const validations = new Array<Validation<void>>();
    // eslint-disable-next-line guard-for-in
    for (const k in record) {
      // noinspection JSUnfilteredForInLoop
      const validationOutcome: Validation<option.Option<A[keyof A]>> = record[
        k
      ](json);
      // zet alle resultaten waarvoor de validation ok is
      pipe(
        validationOutcome,
        either.map(
          (maybeValue) => (result[k] = pipe(maybeValue, option.toUndefined))
        )
      ); // forEach
      // combineer alle fails, map de ok's weg (probleem is dat die allemaal een ander type hebben)
      validations.push(
        pipe(
          validationOutcome,
          either.map(() => {})
        )
      );
    }
    // De gesequencte validation is ok als alle deelvalidations ok zijn
    return pipe(
      sequence(validations),
      either.map(() => result as A)
    ); // we hebben het echte resultaat al in de for loop gezet
  };
}

export type InterpreterRecord<A> = {
  readonly [P in Extract<keyof A, string>]: Interpreter<A[P]>;
};

export function interpretRecord<A>(
  record: InterpreterRecord<A>
): Interpreter<A> {
  return (json: Object) => {
    const result = {} as Partial<A>; // Omdat we overal undefined willen kunnen zetten
    const validations = new Array<Validation<void>>();
    // eslint-disable-next-line guard-for-in
    for (const k in record) {
      // noinspection JSUnfilteredForInLoop
      const validationOutcome: Validation<A[keyof A]> = record[k](json);
      // zet alle resultaten waarvoor de validation ok is
      pipe(
        validationOutcome,
        either.map((value) => (result[k] = value))
      ); // forEach
      // combineer alle fails, map de ok's weg (probleem is dat die allemaal een ander type hebben)
      validations.push(
        pipe(
          validationOutcome,
          either.map(() => {})
        )
      );
    }
    // De gesequencte validation is ok als alle deelvalidations ok zijn
    return pipe(
      sequence(validations),
      either.map(() => result as A)
    ); // we hebben het echte resultaat al in de for loop gezet
  };
}

export type InterpreterUndefinedRecord<A> = {
  readonly [P in Extract<keyof A, string>]: Interpreter<A[P] | undefined>;
};

export function interpretUndefinedRecord<A>(
  record: InterpreterUndefinedRecord<A>
): Interpreter<A> {
  return (json: Object) => {
    const result = {} as Partial<A>; // Omdat we overal undefined willen kunnen zetten
    const validations = new Array<Validation<void>>();
    // eslint-disable-next-line guard-for-in
    for (const k in record) {
      // noinspection JSUnfilteredForInLoop
      const validationOutcome: Validation<A[keyof A]> = record[k](json);
      // zet alle resultaten waarvoor de validation ok is
      pipe(
        validationOutcome,
        either.map((value) => (result[k] = value))
      ); // forEach
      // combineer alle fails, map de ok's weg (probleem is dat die allemaal een ander type hebben)
      validations.push(
        pipe(
          validationOutcome,
          either.map(() => {})
        )
      );
    }
    // De gesequencte validation is ok als alle deelvalidations ok zijn
    return pipe(
      sequence(validations),
      either.map(() => result as A)
    ); // we hebben het echte resultaat al in de for loop gezet
  };
}

function sequence<T>(validations: Validation<T>[]): Validation<T[]> {
  return array.sequence(validationAp)(validations);
}

export function mapOptionRecord<A, B>(
  f: (a: A) => B,
  record: InterpreterOptionalRecord<A>
): Interpreter<B> {
  return map(f, interpretOptionalRecord(record));
}

export function mapRecord<A, B>(
  f: (a: A) => B,
  record: InterpreterRecord<A>
): Interpreter<B> {
  return map(f, interpretRecord(record));
}

export function byTypeDiscriminator<T>(
  discriminatorField: string,
  interpretersByKind: { [k: string]: Interpreter<T> }
): Interpreter<T> {
  return (json: Object) => {
    return chain(field(discriminatorField, str), (kind: string) =>
      pipe(
        option.fromNullable(interpretersByKind[kind]),
        option.getOrElse(() => () =>
          fail<T>(`Het typediscriminatieveld bevat een onbekend type '${kind}'`)
        )
      )
    )(json);
  };
}

export function value<T extends string | number | boolean>(
  value: T
): Interpreter<T> {
  return (json: Object) =>
    json === value
      ? success(value)
      : fail<T>(`De waarde '${value}' was verwacht`);
}

export function suchThat<T, U extends T>(
  interpreter: Interpreter<T>,
  refinement: Refinement<T, U>,
  failureMsg: string
): Interpreter<U> {
  return chain(interpreter, (a) =>
    refinement(a) ? succeed(a) : () => fail<U>(failureMsg)
  );
}

export function mapFailure<T>(
  interpreter: Interpreter<T>,
  failureMsgF: (msgs: string[]) => string[]
): Interpreter<T> {
  return (json: Object) =>
    pipe(interpreter(json), either.bimap(failureMsgF, identity));
}

export function mapFailureTo<T>(
  interpreter: Interpreter<T>,
  failureMsg: string
): Interpreter<T> {
  return mapFailure(interpreter, () => [failureMsg]);
}

export function trace<T>(
  lbl: string,
  interpreter: Interpreter<T>
): Interpreter<T> {
  return (json: Object) => {
    const result = interpreter(json);
    console.log(lbl, json, result);
    return result;
  };
}

export function toString(json: Object): string {
  return JSON.stringify(json);
}
