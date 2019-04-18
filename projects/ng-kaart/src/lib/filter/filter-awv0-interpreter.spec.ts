import * as oi from "../stijl/json-object-interpreting";

import { AwvV0FilterInterpreters } from "./filter-awv0-interpreter";
import { Filter, Literal, Property, PureFilter } from "./filter-model";

describe("De filterinterpreter", () => {
  describe("bij het interpreteren van geldige structuren", () => {
    const property: Property = Property("string", "prop");
    const literal: Literal = Literal("string", "value");
    it("moet een 'pure' filter kunnen verwerken", () => {
      const pure: Filter = PureFilter;
      const result = AwvV0FilterInterpreters.jsonAwv0Definition(pure);
      expect(result.isSuccess()).toBe(true);
      expect(result.getOrElse(undefined)).toEqual(pure);
    });
    it("moet een filter met 1 'gelijk aan' kunnen verwerken", () => {
      const eq: Filter = {
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
      expect(result.getOrElse(undefined)).toEqual(eq);
    });
    it("moet een filter met 1 'niet gelijk aan' kunnen verwerken", () => {
      const neq: Filter = {
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
      expect(result.getOrElse(undefined)).toEqual(neq);
    });
    it("moet een filter met 1 'and' kunnen verwerken", () => {
      const and: Filter = {
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
      expect(result.getOrElse(undefined)).toEqual(and);
    });
    it("moet een filter met 2x 'and' kunnen verwerken", () => {
      const and: Filter = {
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
      expect(result.getOrElse(undefined)).toEqual(and);
    });
    it("moet een filter met 1 'or' kunnen verwerken", () => {
      const or: Filter = {
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
      expect(result.getOrElse(undefined)).toEqual(or);
    });
    it("moet een filter met 2x 'or' kunnen verwerken", () => {
      const or: Filter = {
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
      expect(result.getOrElse(undefined)).toEqual(or);
    });
    it("moet een filter met 'or' en 'and' kunnen verwerken", () => {
      const orAnd: Filter = {
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
      expect(result.getOrElse(undefined)).toEqual(orAnd);
    });
  });
});
