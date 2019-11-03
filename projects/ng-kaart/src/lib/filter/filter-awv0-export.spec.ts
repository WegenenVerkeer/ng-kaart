import { none, some } from "fp-ts/lib/Option";

import { FilterAwv0Json } from "./filter-awv0-export";
import { Filter as fltr } from "./filter-model";

describe("De filter exporter", () => {
  const property: fltr.Property = fltr.Property("string", "prop", "Property", "DD/MM/YYYY");
  const literal: fltr.Literal = fltr.Literal("string", "value");
  describe("bij het exporteren van een expression filter", () => {
    it("moet een gezette naam naar een gezet 'name' veld omzetten", () => {
      const filter: fltr.ExpressionFilter = {
        kind: "ExpressionFilter",
        name: some("testFilter"),
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          property: property,
          value: literal,
          caseSensitive: false
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
          kind: "BinaryComparison",
          operator: "equality",
          property: property,
          value: literal,
          caseSensitive: false
        }
      };
      const encoded = FilterAwv0Json.encode(filter);
      const resurrected = JSON.parse(encoded);
      expect(resurrected.definition.name).toBeUndefined();
    });
    describe("voor binaire expressies", () => {
      it("moet een 'groter dan' kunnen exporteren", () => {
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: none,
          expression: {
            kind: "BinaryComparison",
            operator: "larger",
            property: property,
            value: literal,
            caseSensitive: false
          }
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "BinaryComparison",
            operator: "larger",
            property: property,
            value: literal,
            caseSensitive: false
          }
        });
      });
    });
    describe("voor unaire expressies", () => {
      it("moet een 'heeft een waarde' kunnen exporteren", () => {
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: none,
          expression: {
            kind: "UnaryComparison",
            operator: "isNotEmpty",
            property: property
          }
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "UnaryComparison",
            operator: "isNotEmpty",
            property: property
          }
        });
      });
      it("moet een 'heeft geen waarde' kunnen exporteren", () => {
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: none,
          expression: {
            kind: "UnaryComparison",
            operator: "isEmpty",
            property: property
          }
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "UnaryComparison",
            operator: "isEmpty",
            property: property
          }
        });
      });
    });
  });
});
