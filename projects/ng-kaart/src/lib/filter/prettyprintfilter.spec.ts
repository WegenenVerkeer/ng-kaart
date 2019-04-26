import { right } from "fp-ts/lib/Either";

import { Equality, Filter, Inequality, Literal, PrettyPrintFilter, Property, PureFilter } from "./filter-model";

describe("De pretty print van een filter", () => {
  const property: Property = Property("string", "eigenschap");
  const literal: Literal = Literal("string", "waarde");
  it("moet een 'pure' filter kunnen verwerken", () => {
    const pure: Filter = PureFilter;
    const result = PrettyPrintFilter.prettyPrint(pure);
    expect(result).toBe("alle waarden");
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
    const result = PrettyPrintFilter.prettyPrint(eq);
    expect(result).toBe("eigenschap is waarde");
  });
  it("moet uxpin voorbeeld kunnen verwerken", () => {
    const voorbeeld: Filter = {
      kind: "ExpressionFilter",
      name: "Veilge fietspaden",
      expression: {
        kind: "Or",
        left: {
          kind: "And",
          left: {
            kind: "And",
            left: Equality(Property("string", "Kleur"), Literal("string", "rood")),
            right: Inequality(Property("double", "Breedte"), Literal("double", 90))
          },
          right: Equality(Property("string", "Type"), Literal("string", "aanliggend"))
        },
        right: Equality(Property("string", "Type"), Literal("string", "vrijliggend"))
      }
    };
    const result = PrettyPrintFilter.prettyPrint(voorbeeld);
    expect(result).toBe(
      "( Kleur is rood  <b>EN</b>  Breedte is niet 90  <b>EN</b>  Type is aanliggend )  <b>OF</b>  ( Type is vrijliggend )"
    );
  });
});
