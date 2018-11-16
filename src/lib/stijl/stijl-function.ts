import * as ol from "openlayers";

import { validationChain as chain, validationChain2, Validator } from "../util/validation";

import { jsonAwvV0RuleCompiler, jsonAwvV0RuleInterpreter } from "./json-awv-v0-stijlfunctie";
import { Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { Awv0DynamicStyle } from "./stijl-function-types";
import { properlyJsonDeclaredText, textToJson } from "./text-json";

///////////////////////////////////////////////////
// De externe input valideren als een StyleFunction
//

// type StyleFunction = (feature: (ol.Feature | ol.render.Feature), resolution: number) => (ol.style.Style | ol.style.Style[]);
export function definitieToStyleFunction(encoding: string, definitieText: string): Validation<ol.StyleFunction> {
  return chain(validateAsDynamicStyle(encoding, definitieText), validateAwv0RuleDefintion);
}

export function validateAsDynamicStyle(encoding: string, definitieText: string): Validation<Awv0DynamicStyle> {
  return validationChain2(properlyJsonDeclaredText(encoding, definitieText), textToJson, interpretJsonAsSpec);
}

function interpretJsonAsSpec(definitie: Object): Validation<Awv0DynamicStyle> {
  return chain(oi.field("version", oi.str)(definitie), version => {
    switch (version) {
      case "awv-v0":
        return oi.field("definition", jsonAwvV0RuleInterpreter)(definitie);
      default:
        return oi.fail(`Versie '${version}' wordt niet ondersteund`);
    }
  });
}

export const validateAwv0RuleDefintion: Validator<Awv0DynamicStyle, ol.StyleFunction> = jsonAwvV0RuleCompiler;
