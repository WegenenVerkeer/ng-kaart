import { Function1, Function2 } from "fp-ts/lib/function";
import { fromNullable, none, some } from "fp-ts/lib/Option";

import { Consumer1, Consumer2 } from "../util/function";

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

const fixOptionals: Function1<any, fltr.Filter> = rawFilter =>
  (modifyKinded(rawFilter, {
    ExpressionFilter: ef => (ef.name = fromNullable(ef.name))
  }) as any) as fltr.Filter; // super fishy. gelukkig "maar" een test

describe("De filterinterpreter", () => {
  const property: fltr.Property = fltr.Property("string", "prop", "Property", "DD/MM/YYYY");
  const literal: fltr.Literal = fltr.Literal("string", "value");
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
          property: property,
          value: literal,
          caseSensitive: false
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixOptionals(eq));
    });
    it("moet een filter met 1 case sensitive 'gelijk aan' kunnen verwerken", () => {
      const eq = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          property: property,
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
          property: property,
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
          property: property,
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
          property: property,
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
          property: property
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
          property: property
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
            property: property,
            value: literal,
            caseSensitive: false
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property,
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
              property: property,
              value: literal,
              caseSensitive: false
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property,
              value: literal,
              caseSensitive: false
            }
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property,
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
            property: property,
            value: literal,
            caseSensitive: false
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property,
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
              property: property,
              value: literal,
              caseSensitive: false
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property,
              value: literal,
              caseSensitive: false
            }
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property,
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
              property: property,
              value: literal,
              caseSensitive: false
            },
            right: {
              kind: "BinaryComparison",
              operator: "equality",
              property: property,
              value: literal,
              caseSensitive: false
            }
          },
          right: {
            kind: "BinaryComparison",
            operator: "equality",
            property: property,
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
          property: property,
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
