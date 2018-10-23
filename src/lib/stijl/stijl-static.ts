import * as ol from "openlayers";

import { failure, validationChain as chain, Validator } from "../util/validation";

import { jsonAwvV0Style, shortcutOrFullStyle } from "./json-awv-v0-stijl";
import { Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { Awv0StaticStyle } from "./stijl-static-types";

// Door de beschrijvingsstijl in de kaartcomponent te steken, kunnen ook andere applicaties er gebruik van maken.
// Nog beter is om (op termijn) dit in een afzonderlijke module te steken.
// Best wachten we tot de interface min of meer stabiel is.

// Vanaf hier zou het iets stabieler moeten zijn
export type ValidatedOlStyle = Validation<ol.style.Style>;

export function definitieToStyle(encoding: string, definitieText: string): ValidatedOlStyle {
  if (encoding === "json") {
    return jsonDefinitieStringToStyle(definitieText);
  } else {
    return oi.fail(`Encoding '${encoding}' wordt niet ondersteund`);
  }
}

function jsonDefinitieStringToStyle(definitieText: string): ValidatedOlStyle {
  try {
    const object = JSON.parse(definitieText);
    return interpretJson(object);
  } catch (error) {
    return oi.fail(`De gegeven stijldefinitie was geen geldige JSON: ${error}`);
  }
}

function interpretJson(definition: Object): Validation<ol.style.Style> {
  return chain(oi.field("version", oi.str)(definition), version => {
    switch (version) {
      case "awv-v0":
        return shortcutOrFullStyle(definition);
      default:
        return oi.fail(`Versie '${version}' wordt niet ondersteund`);
    }
  });
}

// Een alias voor interpretJson die ons custom type neemt ipv gewoon een gedeserialiseerde jSON
export const validateAwv0StaticStyle: Validator<Awv0StaticStyle, ol.style.Style> = jsonAwvV0Style;

// Dit gaat uiteraard enkel gegarandeerd lukken voor stylen die we zelf gegenereerd hebben.
export const styleToDefintie: Validator<ol.style.Style, Awv0StaticStyle> = style => {
  return failure("nog niet geimplementeerd");
};
