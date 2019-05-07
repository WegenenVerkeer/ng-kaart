import { none, some } from "fp-ts/lib/Option";

import { FilterAwv0Json } from "./filter-awv0-export";
import { Filter as fltr } from "./filter-model";

describe("De filter exporter", () => {
  const property: fltr.Property = fltr.Property("string", "prop", "Property");
  const literal: fltr.Literal = fltr.Literal("string", "value");
  describe("bij het exporteren van een expression filter", () => {
    it("moet een gezette naam naar een gezet 'name' veld omzetten", () => {
      const filter: fltr.ExpressionFilter = {
        kind: "ExpressionFilter",
        name: some("testFilter"),
        expression: {
          kind: "Equality",
          property: property,
          value: literal
        }
      };
      const encoded = FilterAwv0Json.encode(filter);
      const resurrected = JSON.parse(encoded);
      expect(resurrected.definition.name).toEqual("testFilter");
    });
    it("moet een nietgezette naam naar een definitie zonder 'name' veld omzetten", () => {
      const filter: fltr.ExpressionFilter = {
        kind: "ExpressionFilter",
        name: none,
        expression: {
          kind: "Equality",
          property: property,
          value: literal
        }
      };
      const encoded = FilterAwv0Json.encode(filter);
      const resurrected = JSON.parse(encoded);
      expect(resurrected.definition.name).toBeUndefined();
    });
  });
});
