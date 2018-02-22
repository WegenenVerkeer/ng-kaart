import { definitieToRuleExecutor } from "./stijl-selector";

import * as ol from "openlayers";

describe("de stijl selector", () => {
  describe("bij het evalueren van geldige stijlselectiefuncties", () => {
    const feature = new ol.Feature({
      offsetZijde: "R",
      textProp: "text",
      numProp: 3.1415,
      boolProp: false,
      nullProp: null,
      undefinedProp: undefined
    });
    const resolution = 32;
    it("moet een stijl selecteren adhv een enkele regel obv een Literal", () => {
      const result = definitieToRuleExecutor(
        "json",
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                condition: {
                  kind: "Literal",
                  value: true
                },
                style: {
                  definition: {}
                }
              }
            ]
          }
        })
      );
      expect(result.isSuccess()).toBe(true);
      expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(new ol.style.Style());
    });

    it("moet een stijl selecteren adhv een complexe expressie", () => {
      const result = definitieToRuleExecutor(
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
                    left: { kind: "Feature", type: "string", ref: "offsetZijde" },
                    right: { kind: "Literal", value: "R" }
                  },
                  right: {
                    kind: "<=>",
                    value: { kind: "Environment", type: "number", ref: "resolution" },
                    lower: { kind: "Literal", value: 0 },
                    upper: { kind: "Literal", value: 2048 }
                  }
                },
                style: {
                  shortcut: {
                    fullLine: {
                      width: 5,
                      color: "#FFFF00"
                    }
                  },
                  definition: {}
                }
              }
            ]
          }
        })
      );
      expect(result.isSuccess()).toBe(true);
      expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(
        new ol.style.Style({ stroke: new ol.style.Stroke({ width: 5, color: "#FFFF00" }) })
      );
    });

    it("moet een stijl kunnen selecteren adhv de eerste lukkende regel", () => {
      const result = definitieToRuleExecutor(
        "json",
        JSON.stringify({
          version: "awv-v0",
          definition: {
            rules: [
              {
                condition: { kind: "Literal", value: false },
                style: { definition: {} }
              },
              {
                condition: { kind: "Literal", value: true },
                style: { definition: { stroke: { color: "green" } } }
              }
            ]
          }
        })
      );
      expect(result.isSuccess()).toBe(true);
      expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(
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
                  upper: { kind: "Literal", value: upper }
                },
                style: {
                  definition: {}
                }
              }
            ]
          }
        });

      const resultInside = definitieToRuleExecutor("json", inBetweenStanza(1, 0, 10));
      expect(resultInside.isSuccess()).toBe(true);
      expect(resultInside.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(new ol.style.Style());

      const resultBelow = definitieToRuleExecutor("json", inBetweenStanza(-1, 0, 10));
      expect(resultBelow.isSuccess()).toBe(true);
      expect(resultBelow.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(undefined);

      const resultAbove = definitieToRuleExecutor("json", inBetweenStanza(11, 0, 10));
      expect(resultAbove.isSuccess()).toBe(true);
      expect(resultAbove.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(undefined);
    });

    describe("bij het refereren aan feature properties", () => {
      it("moet de waarde van de feature gebruiken", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Feature", type: "string", ref: "offsetZijde" },
                    right: { kind: "Literal", value: "R" }
                  },
                  style: {
                    definition: {}
                  }
                }
              ]
            }
          })
        );

        expect(result.isSuccess()).toBe(true);
        expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(new ol.style.Style({}));
      });

      it("moet de conditie falen als de propery niet bestaat", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Feature", type: "string", ref: "onbestaand" },
                    right: { kind: "Literal", value: "R" }
                  },
                  style: {
                    definition: {}
                  }
                }
              ]
            }
          })
        );

        expect(result.isSuccess()).toBe(true);
        expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(undefined);
      });

      it("moet de conditie falen als de propery een null waarde heeft", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Feature", type: "string", ref: "nullProp" },
                    right: { kind: "Literal", value: "R" }
                  },
                  style: {
                    definition: {}
                  }
                }
              ]
            }
          })
        );

        expect(result.isSuccess()).toBe(true);
        expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(undefined);
      });

      it("moet de conditie falen als de propery een undefined waarde heeft", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Feature", type: "string", ref: "undefinedProp" },
                    right: { kind: "Literal", value: "R" }
                  },
                  style: {
                    definition: {}
                  }
                }
              ]
            }
          })
        );

        expect(result.isSuccess()).toBe(true);
        expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(undefined);
      });

      it("moet de conditie niet noodzakelijk falen als de propery een false waarde heeft", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Feature", type: "boolean", ref: "boolProp" },
                    right: { kind: "Literal", value: false }
                  },
                  style: {
                    definition: {}
                  }
                }
              ]
            }
          })
        );
        expect(result.isSuccess()).toBe(true);
        expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(new ol.style.Style({}));
      });

      it("moet de conditie falen als het actuele type van de feature niet overeenstemt met het gedeclareerde", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: {
                    kind: "==",
                    left: { kind: "Feature", type: "string", ref: "numProp" },
                    right: { kind: "Literal", value: "R" }
                  },
                  style: {
                    definition: {}
                  }
                }
              ]
            }
          })
        );

        expect(result.isSuccess()).toBe(true);
        expect(result.map(f => f(feature, resolution)).getOrElseValue(undefined)).toEqual(undefined);
      });
    });
  });

  describe("Bij het compileren van stijlfuncties", () => {
    describe("wanneer de regels geen fouten bevatten", () => {
      it("moet een succesvolle validatie genereren", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: { kind: "Literal", value: true },
                  style: { definition: {} }
                }
              ]
            }
          })
        );
        expect(result.isSuccess()).toBe(true);
      });
    });

    describe("wanneer de regels fouten bevatten", () => {
      it("mag enkel de awv-v0 version toelaten", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v314",
            definition: {
              rules: [
                {
                  condition: { kind: "Literal", value: "true" },
                  style: { definition: {} }
                }
              ]
            }
          })
        );
        expect(result.isFailure()).toBe(true);
        expect(result.value).toContain("'awv-v314' wordt niet ondersteund");
      });

      it("moet een ongeldige JSON detecteren", () => {
        const result = definitieToRuleExecutor("json", "dit is geen JSON");
        expect(result.isFailure()).toBe(true);
        expect(result.value).toContain("geen geldige JSON");
      });

      it("mag enkel boolean resultaten toelaten", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: { kind: "Literal", value: "true" },
                  style: { definition: {} }
                }
              ]
            }
          })
        );
        expect(result.isFailure()).toBe(true);
        expect(result.value).toContain("typecontrole:");
        expect(result.value).toContain("moet een 'boolean' opleveren");
      });

      it("mag enkel een vergelijking met 2 argumenten toelaten", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: { kind: "<=", left: { kind: "Literal", value: "1" } },
                  style: { definition: {} }
                }
              ]
            }
          })
        );
        expect(result.isFailure()).toBe(true);
        expect(result.value).toContain("syntaxcontrole:");
        expect(result.value).toContain("heeft geen veld 'right'");
      });
      it("mag enkel een groottevergelijking met 2 numerieke argumenten toelaten", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: { kind: "<=", left: { kind: "Literal", value: "1" }, right: { kind: "Literal", value: "2" } },
                  style: { definition: {} }
                }
              ]
            }
          })
        );
        expect(result.isFailure()).toBe(true);
        expect(result.value).toContain("typecontrole:");
        expect(result.value).toContain("'string' en 'string' gevonden, maar telkens 'number' verwacht");
      });
      it("mag enkel een vergelijking met 2 gelijke argumenten toelaten", () => {
        const result = definitieToRuleExecutor(
          "json",
          JSON.stringify({
            version: "awv-v0",
            definition: {
              rules: [
                {
                  condition: { kind: "!=", left: { kind: "Literal", value: "1" }, right: { kind: "Literal", value: 2 } },
                  style: { definition: {} }
                }
              ]
            }
          })
        );
        expect(result.isFailure()).toBe(true);
        expect(result.value).toContain("typecontrole:");
        expect(result.value).toContain("verwacht dat 'string' en 'number' gelijk zijn");
      });
    });
  });
});
