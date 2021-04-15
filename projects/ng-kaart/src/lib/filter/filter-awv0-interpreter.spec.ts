import { either, eq, option } from "fp-ts";
import { Lazy } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/function";
import { DateTime } from "luxon";

import { Consumer1, Consumer2 } from "../util/function";
import { NoOptionRecord, optionsToUndefined } from "../util/option";

import { AwvV0FilterInterpreters } from "./filter-awv0-interpreter";
import { Filter as fltr } from "./filter-model";

// Beware of lots of dragons here
const modifyKinded: Consumer2<any, { [p: string]: Consumer1<any> }> = (
  obj,
  modifiersByKind
) => {
  if (modifiersByKind.hasOwnProperty(obj["kind"])) {
    modifiersByKind[obj["kind"]](obj);
  }
  if (typeof obj === "object") {
    Object.values(obj).forEach((value) => {
      modifyKinded(value, modifiersByKind);
    });
  }
  return obj;
};

const isOption = (obj: unknown): obj is option.Option<unknown> =>
  typeof obj === "object" && (obj["_tag"] === "Some" || obj["_tag"] === "None");
const ensureOption = (obj: unknown): unknown =>
  !isOption(obj) ? option.fromNullable(obj) : obj;

// We willen zo weinig mogelijk duplicatie in onze testen. Wat we parsen bevat enkel basis datatypes, geen Options. De
// output echter, bevat wel Options. Voor de rest is echter alles gelijk. Daarom "fixen" we de velden waarvan we weten
// dat het Optionals moeten zijn obv de ruwe waarde (als die er is).
const fixOptionals: (rawFilter: any) => fltr.Filter = (rawFilter) =>
  (modifyKinded(rawFilter, {
    ExpressionFilter: (ef) => (ef.name = ensureOption(ef.name)),
    Property: (prop) => (prop.sqlFormat = ensureOption(prop.sqlFormat)),
  }) as any) as fltr.Filter; // super fishy. gelukkig "maar" een test

describe("De filterinterpreter", () => {
  // Option is lazy omdat we met fixOptionals de instantie in-place wijzigen. We kunnen die dan niet meer hergebruiken.
  const property: Lazy<NoOptionRecord<fltr.Property>> = () =>
    optionsToUndefined(
      fltr.Property("string", "prop", "Property", "DD/MM/YYYY")
    );
  const literal: fltr.Literal = fltr.Literal("string", "value");
  beforeEach(() => {
    // Jasmine kan standaard niet overweg met fp-ts options
    const isStringSome = (obj: unknown): obj is option.Some<string> =>
      typeof obj === "object" &&
      obj["_tag"] === "Some" &&
      typeof obj["value"] === "string";
    const isNone = (obj): obj is option.None =>
      typeof obj === "object" && obj["_tag"] === "None";
    jasmine.addCustomEqualityTester((opt1, opt2) => {
      if (isStringSome(opt1) && isStringSome(opt2)) {
        return option.getEq(eq.eqString).equals(opt1, opt2);
      } else {
        return undefined;
      }
    });
    jasmine.addCustomEqualityTester((opt1, opt2) => {
      if (isNone(opt1) && isNone(opt2)) {
        return true;
      } else {
        return undefined;
      }
    });
  });
  describe("bij het interpreteren van geldige structuren", () => {
    it("moet een 'empty' filter kunnen verwerken", () => {
      const empty: fltr.Filter = fltr.empty();
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(empty);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(empty);
    });
    it("moet een filter met 1 'gelijk aan' kunnen verwerken", () => {
      const eq = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          property: property(),
          value: literal,
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(eq));
    });
    it("moet een filter met 1 case sensitive 'gelijk aan' kunnen verwerken", () => {
      const eq = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          property: property(),
          value: literal,
          caseSensitive: true,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(eq));
    });
    it("moet een filter met 1 niet case sensitive 'gelijk aan' kunnen verwerken", () => {
      const eq = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          property: property(),
          value: literal,
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(eq));
    });
    it("moet een filter met 1 'niet gelijk aan' kunnen verwerken", () => {
      const neq = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "inequality",
          property: property(),
          value: literal,
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(neq);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(neq));
    });
    it("moet een filter met 1 'begint met' kunnen verwerken", () => {
      const neq = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "starts",
          property: property(),
          value: literal,
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(neq);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(neq));
    });
    it("moet een filter met 1 'geen waarde' kunnen verwerken", () => {
      const ndef = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "UnaryComparison",
          operator: "isEmpty",
          property: property(),
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(ndef);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(ndef));
    });
    it("moet een filter met 1 'heeft een waarde' kunnen verwerken", () => {
      const def = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "UnaryComparison",
          operator: "isNotEmpty",
          property: property(),
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(def);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(def));
    });
    it("moet een filter met 1 'within' kunnen verwerken", () => {
      const def = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "within",
          property: { ...property(), type: "date" },
          value: {
            ...literal,
            type: "range",
            value: { unit: "year", magnitude: 3 },
          },
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(def);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(def));
    });
    it("moet een filter met 1 '<=' date kunnen verwerken", () => {
      const def = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "smallerOrEqual",
          property: { ...property(), type: "date" },
          value: { ...literal, type: "date", value: "31/12/2019" },
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(def);
      expect(either.isRight(result)).toBe(true);
      const exprValue = pipe(
        result,
        either.getOrElse(() => undefined)
      );
      expect(exprValue.kind).toEqual("ExpressionFilter");
      const expr = exprValue as fltr.ExpressionFilter;
      expect(expr.expression.kind).toEqual("BinaryComparison");
      const comp = expr.expression as fltr.BinaryComparison;
      expect(comp.operator).toBe("smallerOrEqual");
      expect(comp.value.type).toBe("date");
      const dateValue = comp.value.value as DateTime;
      expect(dateValue.year).toEqual(DateTime.local(2019, 12, 31).year);
      expect(dateValue.month).toEqual(DateTime.local(2019, 12, 31).month);
      expect(dateValue.day).toEqual(DateTime.local(2019, 12, 31).day);
    });
    it("moet een filter met 1 'and' kunnen verwerken", () => {
      const and = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "And",
          left: {
            kind: "BinaryComparison",
            operator: "inequality",
            property: property(),
            value: literal,
            caseSensitive: false,
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false,
          },
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(and);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(and));
    });
    it("moet een filter met 2x 'and' kunnen verwerken", () => {
      const and = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "And",
          left: {
            kind: "And",
            left: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false,
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false,
            },
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false,
          },
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(and);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(and));
    });
    it("moet een filter met 1 'or' kunnen verwerken", () => {
      const or = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Or",
          left: {
            kind: "BinaryComparison",
            operator: "inequality",
            property: property(),
            value: literal,
            caseSensitive: false,
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false,
          },
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(or);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(or));
    });
    it("moet een filter met 2x 'or' kunnen verwerken", () => {
      const or = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Or",
          left: {
            kind: "Or",
            left: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false,
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false,
            },
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false,
          },
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(or);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(or));
    });
    it("moet een filter met 'or' en 'and' kunnen verwerken", () => {
      const orAnd = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Or",
          left: {
            kind: "And",
            left: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false,
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false,
            },
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false,
          },
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(orAnd);
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.getOrElse(() => undefined)
        )
      ).toEqual(fixOptionals(orAnd));
    });
  });
  describe("Bij het interpreteren van ongeldige structuren", () => {
    it("moet een fout geven bij een expressie met een ontbrekende property", () => {
      const eq: Object = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          value: literal,
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(either.isLeft(result)).toBe(true);
      expect(
        pipe(
          result,
          either.fold(
            (msgs) =>
              msgs.find((m) => m.endsWith("heeft geen veld 'property'")),
            () => undefined
          )
        )
      ).toBeTruthy();
    });
    it("moet een fout geven wanneer een literal van het range type geen Range object bevat", () => {
      const def = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "within",
          property: { ...property(), type: "date" },
          value: { ...literal, type: "range", value: "01/01/2019" },
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(def);
      expect(either.isLeft(result)).toBe(true);
      expect(
        pipe(
          result,
          either.fold(
            (msgs) =>
              msgs.includes(
                "De operator, property en de waarde komen niet overeen"
              ),
            () => undefined
          )
        )
      ).toBe(true);
    });
    it("moet een fout geven wanneer het type van de operator, property en waarde niet overeenkomen", () => {
      const eq: Object = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "inequality",
          property: property(),
          value: { ...literal, type: "double" },
          caseSensitive: false,
        },
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(either.isLeft(result)).toBe(true);
      expect(
        pipe(
          result,
          either.fold(
            (msgs) =>
              msgs.includes(
                "Het type van de property komt niet overeen met dat van de waarde"
              ),
            () => undefined
          )
        )
      ).toBe(true);
    });
  });
});
