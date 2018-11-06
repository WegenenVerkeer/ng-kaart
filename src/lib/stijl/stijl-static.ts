import { Function1, Function2 } from "fp-ts/lib/function";
import * as ol from "openlayers";

import { validationChain as chain, Validator } from "../util/validation";

import { jsonAwvV0Definition, jsonAwvV0Style } from "./json-awv-v0-stijl";
import { Validation } from "./json-object-interpreting";
import * as oi from "./json-object-interpreting";
import { Awv0StaticStyle } from "./stijl-static-types";

// Door de beschrijvingsstijl in de kaartcomponent te steken, kunnen ook andere applicaties er gebruik van maken.
// Nog beter is om (op termijn) dit in een afzonderlijke module te steken.
// Best wachten we tot de interface min of meer stabiel is.

const properlyJsonDeclaredText: Function2<string, string, Validation<string>> = (encoding, text) =>
  encoding === "json" ? oi.ok(text) : oi.fail(`Encoding '${encoding}' wordt niet ondersteund`);

const textToJson: Validator<string, object> = text => {
  try {
    const json: any = JSON.parse(text);
    if (typeof json === "object") {
      return oi.ok(json);
    } else {
      return oi.fail(`De gegeven stijldefinitie was geen geldig JSON object maar een '${typeof json}'`);
    }
  } catch (error) {
    return oi.fail(`De gegeven stijldefinitie was geen geldige JSON: ${error}`);
  }
};

// Vanaf hier zou het iets stabieler moeten zijn
export function definitieToStyle(encoding: string, definitieText: string): Validation<ol.style.Style> {
  return chain(chain(properlyJsonDeclaredText(encoding, definitieText), textToJson), interpretJsonAsStyle);
}

export function definitieToBron(encoding: string, definitieText: string): Validation<Awv0StaticStyle> {
  return chain(chain(properlyJsonDeclaredText(encoding, definitieText), textToJson), interpretJsonAsSpec);
}

function interpretJsonAsStyle(json: Object): Validation<ol.style.Style> {
  return chain(oi.field("version", oi.str)(json), version => {
    switch (version) {
      case "awv-v0":
        return jsonAwvV0Definition(json);
      default:
        return oi.fail(`Versie '${version}' wordt niet ondersteund`);
    }
  });
}

function interpretJsonAsSpec(json: Object): Validation<Awv0StaticStyle> {
  return chain(oi.field("version", oi.str)(json), version => {
    switch (version) {
      case "awv-v0":
        return oi.field("definition", js => oi.ok(js as Awv0StaticStyle))(json);
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
