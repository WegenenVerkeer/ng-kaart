import { Function1 } from "fp-ts/lib/function";
import * as ol from "openlayers";

import { validationChain as chain, validationChain2, Validator } from "../util/validation";

import { Awv0StaticStyleInterpreters, jsonAwvV0Style, StaticStyleEncoders } from "./json-awv-v0-stijl";
import { Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { Awv0StaticStyle } from "./stijl-static-types";
import { properlyJsonDeclaredText, textToJson } from "./text-json";

// Door de beschrijvingsstijl in de kaartcomponent te steken, kunnen ook andere applicaties er gebruik van maken.

export function definitieToStyle(encoding: string, definitieText: string): Validation<ol.style.Style> {
  return validateAsStaticStyle(encoding, definitieText).map(StaticStyleEncoders.awvV0Style.encode);
}

export function validateAsStaticStyle(encoding: string, definitieText: string): Validation<Awv0StaticStyle> {
  return validationChain2(properlyJsonDeclaredText(encoding, definitieText), textToJson, interpretJsonAsSpec);
}

function interpretJsonAsSpec(json: Object): Validation<Awv0StaticStyle> {
  return chain(oi.field("version", oi.str)(json), version => {
    switch (version) {
      case "awv-v0":
        return oi.field("definition", Awv0StaticStyleInterpreters.jsonAwvV0Definition)(json);
      default:
        return oi.fail(`Versie '${version}' wordt niet ondersteund`);
    }
  });
}

// Een alias voor interpretJson die ons custom type neemt ipv gewoon een gedeserialiseerde jSON.
// De kans op succesvolle validate is vrij groot.
export const validateAwv0StaticStyle: Validator<Awv0StaticStyle, ol.style.Style> = jsonAwvV0Style;

export const serialiseAwv0StaticStyle: Function1<Awv0StaticStyle, string> = style =>
  JSON.stringify({ version: "awv-v0", definition: style });
