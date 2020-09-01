import { Function1 } from "fp-ts/lib/function";

import * as ol from "../util/openlayers-compat";
import {
  validationChain as chain,
  validationChain2,
  Validator,
} from "../util/validation";

import {
  AwvV0StaticStyleInterpreters,
  jsonAwvV0Style,
  StaticStyleEncoders,
} from "./json-awv-v0-stijl";
import { Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { AwvV0StaticStyle } from "./stijl-static-types";
import { properlyJsonDeclaredText, textToJson } from "./text-json";

// Door de beschrijvingsstijl in de kaartcomponent te steken, kunnen ook andere applicaties er gebruik van maken.

const Version = "awv-v0";

export function definitieToStyle(
  encoding: string,
  definitieText: string
): Validation<ol.style.Style> {
  return validateAsStaticStyle(encoding, definitieText).map(
    StaticStyleEncoders.awvV0Style.encode
  );
}

export function validateAsStaticStyle(
  encoding: string,
  definitieText: string
): Validation<AwvV0StaticStyle> {
  return validationChain2(
    properlyJsonDeclaredText(encoding, definitieText),
    textToJson,
    interpretJsonAsSpec
  );
}

function interpretJsonAsSpec(json: Object): Validation<AwvV0StaticStyle> {
  return chain(oi.field("version", oi.str)(json), (version) => {
    switch (version) {
      case Version:
        return oi.field(
          "definition",
          AwvV0StaticStyleInterpreters.jsonAwvV0Definition
        )(json);
      default:
        return oi.fail(`Versie '${version}' wordt niet ondersteund`);
    }
  });
}

// Een alias voor interpretJson die ons custom type neemt ipv gewoon een gedeserialiseerde jSON.
// De kans op succesvolle validate is vrij groot.
export const validateAwvV0StaticStyle: Validator<
  AwvV0StaticStyle,
  ol.style.Style
> = jsonAwvV0Style;

export const serialiseAwvV0StaticStyle: Function1<AwvV0StaticStyle, string> = (
  style
) => JSON.stringify({ version: Version, definition: style });
