import { option } from "fp-ts";
import { DateTime } from "luxon";

import { FilterAwv0Json } from "./filter-awv0-export";
import { Filter as fltr } from "./filter-model";

describe("De filter exporter", () => {
  const property: fltr.Property = fltr.Property(
    "string",
    "prop",
    "Property",
    "DD/MM/YYYY"
  );
  const encodedProperty: object = { ...property, sqlFormat: "DD/MM/YYYY" };
  const literal: fltr.Literal = fltr.Literal("string", "value");
  describe("bij het exporteren van een expression filter", () => {
    it("moet een gezette naam naar een gezet 'name' veld omzetten", () => {
      const filter: fltr.ExpressionFilter = {
        kind: "ExpressionFilter",
        name: option.some("testFilter"),
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          property: property,
          value: literal,
          caseSensitive: false,
        },
      };
      const encoded = FilterAwv0Json.encode(filter);
      const resurrected = JSON.parse(encoded);
      expect(resurrected.definition.name).toEqual("testFilter");
    });
    it("moet een niet-gezette naam naar een definitie zonder 'name' veld omzetten", () => {
      const filter: fltr.ExpressionFilter = {
        kind: "ExpressionFilter",
        name: option.none,
        expression: {
          kind: "BinaryComparison",
          operator: "equality",
          property: property,
          value: literal,
          caseSensitive: false,
        },
      };
      const encoded = FilterAwv0Json.encode(filter);
      const resurrected = JSON.parse(encoded);
      expect(resurrected.definition.name).toBeUndefined();
    });
    describe("voor binaire expressies", () => {
      it("moet een 'groter dan' kunnen exporteren", () => {
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: option.none,
          expression: {
            kind: "BinaryComparison",
            operator: "larger",
            property: property,
            value: literal,
            caseSensitive: false,
          },
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "BinaryComparison",
            operator: "larger",
            property: encodedProperty,
            value: literal,
            caseSensitive: false,
          },
        });
      });
    });
    describe("voor unaire expressies", () => {
      it("moet een 'heeft een waarde' kunnen exporteren", () => {
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: option.none,
          expression: {
            kind: "UnaryComparison",
            operator: "isNotEmpty",
            property: property,
          },
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "UnaryComparison",
            operator: "isNotEmpty",
            property: encodedProperty,
          },
        });
      });
      it("moet een 'heeft geen waarde' kunnen exporteren", () => {
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: option.none,
          expression: {
            kind: "UnaryComparison",
            operator: "isEmpty",
            property: property,
          },
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "UnaryComparison",
            operator: "isEmpty",
            property: encodedProperty,
          },
        });
      });
    });
    describe("voor een property zonder sqlFormat", () => {
      it("moet het sqlFormat attribuut weglaten", () => {
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: option.none,
          expression: {
            kind: "UnaryComparison",
            operator: "isNotEmpty",
            property: fltr.Property("string", "prop", "Property", undefined),
          },
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "UnaryComparison",
            operator: "isNotEmpty",
            property: {
              kind: "Property",
              type: "string",
              ref: "prop",
              label: "Property",
            },
          },
        });
      });
    });
    describe("voor een date waarde", () => {
      it("moet de datum als goedgefinieerde text encoderen", () => {
        const date = DateTime.fromFormat("2019-11-01", "yyyy-MM-dd");
        const filter: fltr.ExpressionFilter = {
          kind: "ExpressionFilter",
          name: option.none,
          expression: {
            kind: "BinaryComparison",
            operator: "equality",
            property: fltr.Property("date", "prop", "Property", undefined),
            caseSensitive: false,
            value: fltr.Literal("date", date),
          },
        };
        const encoded = FilterAwv0Json.encode(filter);
        const resurrected = JSON.parse(encoded);
        expect(resurrected.definition).toEqual({
          kind: "ExpressionFilter",
          expression: {
            kind: "BinaryComparison",
            operator: "equality",
            property: {
              kind: "Property",
              type: "date",
              ref: "prop",
              label: "Property",
            },
            caseSensitive: false,
            value: {
              kind: "Literal",
              type: "date",
              value: "01/11/2019",
            },
          },
        });
      });
    });
  });
});
