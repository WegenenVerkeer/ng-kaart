import * as ol from "openlayers";

import { jsonAwvV0RuleCompiler } from "./json-awv-v0-stijlfunctie";
import { Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";

///////////////////////////////////////////////////
// De externe input valideren als een StyleFunction
//

// type StyleFunction = (feature: (ol.Feature | ol.render.Feature), resolution: number) => (ol.style.Style | ol.style.Style[]);
export function definitieToStyleFunction(encoding: string, definitieText: string): Validation<ol.StyleFunction> {
  if (encoding === "json") {
    return jsonDefinitieStringToRuleExecutor(definitieText);
  } else {
    return oi.fail(`Formaat '${encoding}' wordt niet ondersteund`);
  }
}

function jsonDefinitieStringToRuleExecutor(definitieText: string): Validation<ol.StyleFunction> {
  try {
    const unvalidatedJson = JSON.parse(definitieText);
    return compileRuleJson(unvalidatedJson);
  } catch (error) {
    return oi.fail(`De gegeven regeldefinitie was geen geldige JSON: ${error}`);
  }
}

function compileRuleJson(definitie: Object): Validation<ol.StyleFunction> {
  return oi
    .field("version", oi.str)(definitie)
    .chain(version => {
      switch (version) {
        case "awv-v0":
          return oi.field("definition", jsonAwvV0RuleCompiler)(definitie);
        default:
          return oi.fail(`Versie '${version}' wordt niet ondersteund`);
      }
    });
}
