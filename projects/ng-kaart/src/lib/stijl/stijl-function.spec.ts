import { either } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as ol from "../util/openlayers-compat";

import { definitieToStyleFunction } from "./stijl-function";

describe("de stijl functie", () => {
  describe("bij het evalueren van geldige stijlselectiefuncties", () => {
    const feature = new ol.Feature({
      properties: {
        offsetZijde: "R",
        textProp: "text",
        numProp: 3.1415,
        boolProp: false,
        nullProp: null,
        undefinedProp: undefined,
        nestedProp: {
          numProp: 3.1415,
          boolProp: false,
        },
      },
    });
    const resolution = 32;
    it("moet een stijl selecteren adhv een enkele regel obv een Literal", () => {
      const result = definitieToStyleFunction(
        "json",
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                condition: {
                  kind: "Literal",
                  value: true,
                },
                style: {
                  definition: {},
                },
              },
            ],
          },
        })
      );
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(new ol.style.Style());
    });
    it("moet een stijl selecteren adhv een regel zonder conditie", () => {
      const result = definitieToStyleFunction(
        "json",
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                style: {
                  definition: {},
                },
              },
            ],
          },
        })
      );
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(new ol.style.Style());
    });

    it("moet een stijl selecteren adhv een complexe expressie", () => {
      const result = definitieToStyleFunction(
        "json",
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                condition: {
                  kind: "&&",
                  left: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "string",
                      ref: "offsetZijde",
                    },
                    right: { kind: "Literal", value: "R" },
                  },
                  right: {
                    kind: "<=>",
                    value: {
                      kind: "Environment",
                      type: "number",
                      ref: "resolution",
                    },
                    lower: { kind: "Literal", value: 0 },
                    upper: { kind: "Literal", value: 2048 },
                  },
                },
                style: {
                  definition: {
                    stroke: {
                      width: 5,
                      color: "#FFFF00",
                    },
                  },
                },
              },
            ],
          },
        })
      );
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(
        new ol.style.Style({
          stroke: new ol.style.Stroke({ width: 5, color: "#FFFF00" }),
        })
      );
    });

    it("moet een stijl kunnen selecteren adhv de eerste lukkende regel", () => {
      const result = definitieToStyleFunction(
        "json",
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                condition: { kind: "Literal", value: false },
                style: { definition: {} },
              },
              {
                condition: { kind: "Literal", value: true },
                style: { definition: { stroke: { color: "green" } } },
              },
            ],
          },
        })
      );
      expect(either.isRight(result)).toBe(true);
      expect(
        pipe(
          result,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(
        new ol.style.Style({ stroke: new ol.style.Stroke({ color: "green" }) })
      );
    });

    it("moet de <=> operator interpreteren als 'in het interval'", () => {
      const inBetweenStanza = (value: number, lower: number, upper: number) =>
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                condition: {
                  kind: "<=>",
                  value: { kind: "Literal", value: value },
                  lower: { kind: "Literal", value: lower },
                  upper: { kind: "Literal", value: upper },
                },
                style: {
                  definition: {},
                },
              },
            ],
          },
        });

      const resultInside = definitieToStyleFunction(
        "json",
        inBetweenStanza(1, 0, 10)
      );
      expect(either.isRight(resultInside)).toBe(true);
      expect(
        pipe(
          resultInside,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(new ol.style.Style());

      const resultBelow = definitieToStyleFunction(
        "json",
        inBetweenStanza(-1, 0, 10)
      );
      expect(either.isRight(resultBelow)).toBe(true);
      expect(
        pipe(
          resultBelow,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(undefined);

      const resultAbove = definitieToStyleFunction(
        "json",
        inBetweenStanza(11, 0, 10)
      );
      expect(either.isRight(resultAbove)).toBe(true);
      expect(
        pipe(
          resultAbove,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(undefined);
    });

    it("moet de L== operator interpreteren als 'left lowercase equals'", () => {
      const lowercaseStanza = (left: string, right: string) =>
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                condition: {
                  kind: "L==",
                  left: { kind: "Literal", value: left },
                  right: { kind: "Literal", value: right },
                },
                style: {
                  definition: {},
                },
              },
            ],
          },
        });

      const resultLeftUpper = definitieToStyleFunction(
        "json",
        lowercaseStanza("Abc", "abc")
      );
      expect(either.isRight(resultLeftUpper)).toBe(true);
      expect(
        pipe(
          resultLeftUpper,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(new ol.style.Style());

      const resultRightUpper = definitieToStyleFunction(
        "json",
        lowercaseStanza("abc", "Abc")
      ); // enkel lowercase van left
      expect(either.isRight(resultRightUpper)).toBe(true);
      expect(
        pipe(
          resultRightUpper,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(undefined);

      const resultBothUpper = definitieToStyleFunction(
        "json",
        lowercaseStanza("Abc", "Abc")
      ); // right moet lowercase zijn
      expect(either.isRight(resultBothUpper)).toBe(true);
      expect(
        pipe(
          resultBothUpper,
          either.map((f) => f(feature, resolution)),
          either.getOrElse(() => undefined)
        )
      ).toEqual(undefined);
    });

    describe("bij het refereren aan feature properties", () => {
      it("moet de waarde van de property gebruiken", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "string",
                      ref: "offsetZijde",
                    },
                    right: { kind: "Literal", value: "R" },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );

        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(new ol.style.Style({}));
      });

      it("moet de waarde van de geneste property gebruiken", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "number",
                      ref: "nestedProp.numProp",
                    },
                    right: { kind: "Literal", value: 3.1415 },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );

        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(new ol.style.Style({}));
      });

      it("moet de conditie falen als de property niet bestaat", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "string",
                      ref: "onbestaand",
                    },
                    right: { kind: "Literal", value: "R" },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );

        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(undefined);
      });

      it("moet de conditie falen als de geneste property niet bestaat", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "string",
                      ref: "nestedProp.onbestaand",
                    },
                    right: { kind: "Literal", value: "R" },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );

        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(undefined);
      });

      it("moet de conditie falen als de property een null waarde heeft", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Property", type: "string", ref: "nullProp" },
                    right: { kind: "Literal", value: "R" },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );

        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(undefined);
      });

      it("moet de conditie falen als de property een undefined waarde heeft", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "string",
                      ref: "undefinedProp",
                    },
                    right: { kind: "Literal", value: "R" },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );

        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(undefined);
      });

      it("moet de conditie niet noodzakelijk falen als de property een false waarde heeft", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "boolean",
                      ref: "boolProp",
                    },
                    right: { kind: "Literal", value: false },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );
        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(new ol.style.Style({}));
      });

      it("moet de conditie niet noodzakelijk falen als de geneste property een false waarde heeft", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: {
                      kind: "Property",
                      type: "boolean",
                      ref: "nestedProp.boolProp",
                    },
                    right: { kind: "Literal", value: false },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );
        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(new ol.style.Style({}));
      });

      it("moet de conditie falen als het actuele type van de property niet overeenstemt met het gedeclareerde", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Property", type: "string", ref: "numProp" },
                    right: { kind: "Literal", value: "R" },
                  },
                  style: {
                    definition: {},
                  },
                },
              ],
            },
          })
        );

        expect(either.isRight(result)).toBe(true);
        expect(
          pipe(
            result,
            either.map((f) => f(feature, resolution)),
            either.getOrElse(() => undefined)
          )
        ).toEqual(undefined);
      });
    });
  });

  describe("Bij het compileren van stijlfuncties", () => {
    describe("wanneer de regels geen fouten bevatten", () => {
      it("moet een succesvolle validatie genereren", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: { kind: "Literal", value: true },
                  style: { definition: {} },
                },
              ],
            },
          })
        );
        expect(either.isRight(result)).toBe(true);
      });
    });

    describe("wanneer de regels fouten bevatten", () => {
      it("mag enkel de awv-v0 version toelaten", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v314",
            definition: {
              rules: [
                {
                  condition: { kind: "Literal", value: "true" },
                  style: { definition: {} },
                },
              ],
            },
          })
        );
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<[string]>).left[0]).toContain(
          "'awv-v314' wordt niet ondersteund"
        );
      });

      it("moet een ongeldige JSON detecteren", () => {
        const result = definitieToStyleFunction("json", "dit is geen JSON");
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<[string]>).left[0]).toContain(
          "geen geldige JSON"
        );
      });

      it("mag enkel boolean resultaten toelaten", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: { kind: "Literal", value: "true" },
                  style: { definition: {} },
                },
              ],
            },
          })
        );
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<[string]>).left[0]).toContain(
          "typecontrole:"
        );
        expect((result as either.Left<[string]>).left[0]).toContain(
          "moet een 'boolean' opleveren"
        );
      });

      it("mag enkel een vergelijking met 2 argumenten toelaten", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "<=",
                    left: { kind: "Literal", value: "1" },
                  },
                  style: { definition: {} },
                },
              ],
            },
          })
        );
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<[string]>).left[0]).toContain(
          "syntaxcontrole:"
        );
        expect((result as either.Left<[string]>).left[0]).toContain(
          "heeft geen veld 'right'"
        );
      });
      it("mag enkel een groottevergelijking met 2 numerieke argumenten toelaten", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "<=",
                    left: { kind: "Literal", value: "1" },
                    right: { kind: "Literal", value: "2" },
                  },
                  style: { definition: {} },
                },
              ],
            },
          })
        );
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<[string]>).left[0]).toContain(
          "typecontrole:"
        );
        expect((result as either.Left<[string]>).left[0]).toContain(
          "'string' en 'string' gevonden, maar telkens 'number' verwacht"
        );
      });
      it("mag enkel een vergelijking met 2 gelijke argumenten toelaten", () => {
        const result = definitieToStyleFunction(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "!=",
                    left: { kind: "Literal", value: "1" },
                    right: { kind: "Literal", value: 2 },
                  },
                  style: { definition: {} },
                },
              ],
            },
          })
        );
        expect(either.isLeft(result)).toBe(true);
        expect((result as either.Left<[string]>).left[0]).toContain(
          "typecontrole:"
        );
        expect((result as either.Left<[string]>).left[0]).toContain(
          "verwacht dat 'string' en 'number' gelijk zijn"
        );
      });
    });
  });
});
