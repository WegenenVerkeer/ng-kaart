import { Function1 } from "fp-ts/lib/function";

import * as ol from "../util/openlayers-compat";
import { validationChain as chain, validationChain2, Validator } from "../util/validation";

import { jsonAwvV0RuleCompiler, jsonAwvV0RuleInterpreter } from "./json-awv-v0-stijlfunctie";
import { Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { AwvV0DynamicStyle } from "./stijl-function-types";
import { properlyJsonDeclaredText, textToJson } from "./text-json";

///////////////////////////////////////////////////
// De externe input valideren als een StyleFunction
//

const Version = "awv-v0";

// type StyleFunction = (feature: (ol.Feature | ol.render.Feature), resolution: number) => (ol.style.Style | ol.style.Style[]);
export function definitieToStyleFunction(encoding: string, definitieText: string): Validation<ol.StyleFunction> {
  return chain(validateAsDynamicStyle(encoding, definitieText), validateAwvV0RuleDefintion);
}

export function validateAsDynamicStyle(encoding: string, definitieText: string): Validation<AwvV0DynamicStyle> {
  return validationChain2(properlyJsonDeclaredText(encoding, definitieText), textToJson, interpretJsonAsSpec);
}

function interpretJsonAsSpec(definitie: Object): Validation<AwvV0DynamicStyle> {
  return chain(oi.field("version", oi.str)(definitie), version => {
    switch (version) {
      case Version:
        return oi.field("definition", jsonAwvV0RuleInterpreter)(definitie);
      default:
        return oi.fail(`Versie '${version}' wordt niet ondersteund`);
    }
  });
}

export const validateAwvV0RuleDefintion: Validator<AwvV0DynamicStyle, ol.StyleFunction> = jsonAwvV0RuleCompiler;

export const serialiseAwvV0DynamicStyle: Function1<AwvV0DynamicStyle, string> = style =>
  JSON.stringify({ version: Version, definition: style });
