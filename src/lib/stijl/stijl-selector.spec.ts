import { definitieToRuleExecutor } from "./stijl-selector";
import { jsonAwvV0Style } from "./json-awv-v0-interpreter";

import * as ol from "openlayers";

describe("de stijl selector", () => {
  describe("bij het evalueren van geldige stijlkiesfuncties", () => {
    const feature = new ol.Feature({
      textProp: "text",
      numProp: 3.1415,
      boolProp: true
    });
    const resolution = 32;
    it("moet een stijl selecteren adhv een enkele regel obv een constante", () => {
      const result = definitieToRuleExecutor(
        "json",
        JSON.stringify({
          versie: "awv-v0",
          definitie: {
            rules: [
              {
                condition: {
                  kind: "Constant",
                  value: true
                },
                style: {
                  definitie: {}
                }
              }
            ]
          }
        })
      );
      expect(result.isSuccess()).toBe(true);
      expect(result.map(f => f(feature, resolution))).toEqual(jsonAwvV0Style("stijl1"));
    });

    it("moet een stijl selecteren adhv een complexe expressie", () => {
      const result = definitieToRuleExecutor(
        "json",
        JSON.stringify({
          versie: "awv-v0",
          definitie: {
            rules: [
              {
                condition: {
                  kind: "&&",
                  left: {
                    kind: "==",
                    left: { kind: "Feature", type: "string", ref: "offsetZijde" },
                    right: { kind: "Constant", value: "R" }
                  },
                  right: {
                    kind: "<=>",
                    value: { kind: "Environment", type: "number", ref: "resolution" },
                    lower: { kind: "Constant", value: 0 },
                    upper: { kind: "Constant", value: 2048 }
                  }
                },
                style: {
                  shortcut: {
                    offsetLijn: {
                      offset: -25,
                      width: 5,
                      color: "#FFFF00"
                    }
                  }
                }
              }
            ]
          }
        })
      );
      expect(result.isSuccess()).toBe(true);
      expect(result.map(f => f(feature, resolution))).toEqual(jsonAwvV0Style("stijl1"));
    });
  });
});
