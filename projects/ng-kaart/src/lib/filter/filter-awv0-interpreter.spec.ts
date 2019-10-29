import { option } from "fp-ts";
import { eqString } from "fp-ts/lib/Eq";
import { Function1, Function2, Lazy } from "fp-ts/lib/function";
import { fromNullable, none, some } from "fp-ts/lib/Option";

import { Consumer1, Consumer2 } from "../util/function";
import { NoOptionRecord, optionsToUndefined } from "../util/option";

import { AwvV0FilterInterpreters } from "./filter-awv0-interpreter";
import { Filter as fltr } from "./filter-model";

// Beware of lots of dragons here
const modifyKinded: Consumer2<any, { [p: string]: Consumer1<any> }> = (obj, modifiersByKind) => {
  if (modifiersByKind.hasOwnProperty(obj["kind"])) {
    modifiersByKind[obj["kind"]](obj);
  }
  if (typeof obj === "object") {
    Object.values(obj).forEach(value => {
      modifyKinded(value, modifiersByKind);
    });
  }
  return obj;
};

const isOption = (obj: unknown): obj is option.Option<unknown> =>
  typeof obj === "object" && (obj["_tag"] === "Some" || obj["_tag"] === "None");
const ensureOption = (obj: unknown): unknown => (!isOption(obj) ? option.fromNullable(obj) : obj);

// We willen zo weinig mogelijk duplicatie in onze testen. Wat we parsen bevat enkel basis datatypes, geen Options. De
// output echter, bevat wel Options. Voor de rest is echter alles gelijk. Daarom "fixen" we de velden waarvan we weten
// dat het Optionals moeten zijn obv de ruwe waarde (als die er is).
const fixOptionals: Function1<any, fltr.Filter> = rawFilter =>
  (modifyKinded(rawFilter, {
    ExpressionFilter: ef => (ef.name = ensureOption(ef.name)),
    Property: prop => (prop.sqlFormat = ensureOption(prop.sqlFormat))
  }) as any) as fltr.Filter; // super fishy. gelukkig "maar" een test

describe("De filterinterpreter", () => {
  // Option is lazy omdat we met fixOptionals de instantie in-place wijzigen. We kunnen die dan niet meer hergebruiken.
  const property: Lazy<NoOptionRecord<fltr.Property>> = () => optionsToUndefined(fltr.Property("string", "prop", "Property", "DD/MM/YYYY"));
  const literal: fltr.Literal = fltr.Literal("string", "value");
  beforeEach(() => {
    // Jasmine kan standaard niet overweg met fp-ts options
    const isStringSome = (obj: unknown): obj is option.Some<string> =>
      typeof obj === "object" && obj["_tag"] === "Some" && typeof obj["value"] === "string";
    const isNone = (obj): obj is option.None<string> => typeof obj === "object" && obj["_tag"] === "None";
    jasmine.addCustomEqualityTester((opt1, opt2) => {
      if (isStringSome(opt1) && isStringSome(opt2)) {
        return option.getEq(eqString).equals(opt1, opt2);
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
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(empty);
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
          caseSensitive: false
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      const target = fixOptionals(eq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(target);
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
          caseSensitive: true
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(eq));
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
          caseSensitive: false
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(eq));
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
          caseSensitive: false
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(neq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(neq));
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
          caseSensitive: false
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(neq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(neq));
    });
    it("moet een filter met 1 'geen waarde' kunnen verwerken", () => {
      const ndef = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "UnaryComparison",
          operator: "isEmpty",
          property: property()
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(ndef);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(ndef));
    });
    it("moet een filter met 1 'heeft een waarde' kunnen verwerken", () => {
      const def = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "UnaryComparison",
          operator: "isNotEmpty",
          property: property()
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(def);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(def));
    });
    it("moet een filter met 1 'heeft een waarde' kunnen verwerken", () => {
      const def = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "UnaryComparison",
          operator: "isNotEmpty",
          property: property()
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(def);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(def));
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
            caseSensitive: false
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(and);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(and));
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
              caseSensitive: false
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false
            }
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(and);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(and));
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
            caseSensitive: false
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(or);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(or));
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
              caseSensitive: false
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false
            }
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(or);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(or));
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
              caseSensitive: false
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property(),
              value: literal,
              caseSensitive: false
            }
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property(),
            value: literal,
            caseSensitive: false
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(orAnd);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(orAnd));
    });
  });
  describe("Bij het interpreteren van ongeldige structuren", () => {
    it("moet een  bij een expressie met een ontbrekende property ", () => {
      const eq: Object = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          value: literal,
          caseSensitive: false
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(result.isFailure()).toBe(true);
      expect(result.fold(msgs => msgs.find(m => m.endsWith("heeft geen veld 'property'")), undefined)).toBeTruthy();
    });
    it("moet een fout geven wanneer het type van property en waarde niet overeenkomen", () => {
      const eq: Object = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "inequality",
          property: property(),
          value: { ...literal, type: "double" },
          caseSensitive: false
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(result.isFailure()).toBe(true);
      expect(result.fold(msgs => msgs.includes("Het type van de property komt niet overeen met dat van de waarde"), undefined)).toBe(true);
    });
  });
});
