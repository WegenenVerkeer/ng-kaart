import { Function1 } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";

import { AwvV0FilterInterpreters } from "./filter-awv0-interpreter";
import { Filter as fltr } from "./filter-model";

// Het type dat we parsen is een platte JSON, dus zonder Option of andere complexe datatypes. Maar voor de rest is het
// zo goed als gelijk aan model type. Om met een minimum aan code en een maximum aan typesafety te kunnen werken,
// introduceren we een type specifiek voor de test.
type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
interface RawExpressionFilter extends Omit<fltr.ExpressionFilter, "name"> {
  readonly name: string | undefined;
}

const fixName: Function1<RawExpressionFilter, fltr.Filter> = rawFilter => ({
  ...rawFilter,
  name: fromNullable(rawFilter.name)
});

describe("De filterinterpreter", () => {
  const property: fltr.Property = fltr.Property("string", "prop", "Property");
  const literal: fltr.Literal = fltr.Literal("string", "value");
  describe("bij het interpreteren van geldige structuren", () => {
    it("moet een 'pure' filter kunnen verwerken", () => {
      const pure: fltr.Filter = fltr.PureFilter;
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(pure);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(pure);
    });
    it("moet een filter met 1 'gelijk aan' kunnen verwerken", () => {
      const eq: RawExpressionFilter = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Equality",
          property: property,
          value: literal
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixName(eq));
    });
    it("moet een filter met 1 'niet gelijk aan' kunnen verwerken", () => {
      const neq: RawExpressionFilter = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Inequality",
          property: property,
          value: literal
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(neq);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixName(neq));
    });
    it("moet een filter met 1 'and' kunnen verwerken", () => {
      const and: RawExpressionFilter = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "And",
          left: {
            kind: "Inequality",
            property: property,
            value: literal
          },
          right: {
            kind: "Equality",
            property: property,
            value: literal
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(and);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixName(and));
    });
    it("moet een filter met 2x 'and' kunnen verwerken", () => {
      const and: RawExpressionFilter = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "And",
          left: {
            kind: "And",
            left: {
              kind: "Equality",
              property: property,
              value: literal
            },
            right: {
              kind: "Equality",
              property: property,
              value: literal
            }
          },
          right: {
            kind: "Equality",
            property: property,
            value: literal
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(and);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixName(and));
    });
    it("moet een filter met 1 'or' kunnen verwerken", () => {
      const or: RawExpressionFilter = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Or",
          left: {
            kind: "Inequality",
            property: property,
            value: literal
          },
          right: {
            kind: "Equality",
            property: property,
            value: literal
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(or);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixName(or));
    });
    it("moet een filter met 2x 'or' kunnen verwerken", () => {
      const or: RawExpressionFilter = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Or",
          left: {
            kind: "Or",
            left: {
              kind: "Equality",
              property: property,
              value: literal
            },
            right: {
              kind: "Equality",
              property: property,
              value: literal
            }
          },
          right: {
            kind: "Equality",
            property: property,
            value: literal
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(or);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixName(or));
    });
    it("moet een filter met 'or' en 'and' kunnen verwerken", () => {
      const orAnd: RawExpressionFilter = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Or",
          left: {
            kind: "And",
            left: {
              kind: "Equality",
              property: property,
              value: literal
            },
            right: {
              kind: "Equality",
              property: property,
              value: literal
            }
          },
          right: {
            kind: "Equality",
            property: property,
            value: literal
          }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(orAnd);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(fixName(orAnd));
    });
  });
  describe("Bij het interpreteren van ongeldige structuren", () => {
    it("moet een fout geven bij een expressie met een ontbrekende property ", () => {
      const eq: Object = {
        kind: "ExpressionFilter",
        name: "testFilter",
        expression: {
          kind: "Equality",
          value: literal
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
          kind: "Inequality",
          property: property,
          value: { ...literal, type: "double" }
        }
      };
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(eq);
      expect(result.isFailure()).toBe(true);
      expect(result.fold(msgs => msgs.includes("Het type van de property komt niet overeen met dat van de waarde"), undefined)).toBe(true);
    });
  });
});
