import * as ol from "openlayers";

import { Validation, Interpreter } from "./json-object-interpreting";
import { jsonAwvV0Style, shortcutStyles } from "./json-awv-v0-interpreter";

import * as oi from "./json-object-interpreting";

// Door de beschrijvingsstijl in de kaartcomponent te steken, kunnen ook andere applicaties er gebruik van maken.
// Nog beter is om (op termijn) dit in een afzonderlijke module te steken.
// Best wachten we tot de interface min of meer stabiel is.

// Vanaf hier zou het iets stabieler moeten zijn
export type StijldefinitieTransformation = Validation<ol.style.Style>;

export function definitieToStyle(formaat: string, definitieText: string): StijldefinitieTransformation {
  if (formaat === "json") {
    return jsonDefinitieStringToStyle(definitieText);
  } else {
    return oi.fail(`Formaat '${formaat}' wordt niet ondersteund`);
  }
}

function jsonDefinitieStringToStyle(definitieText: string): StijldefinitieTransformation {
  try {
    const object = JSON.parse(definitieText);
    return interpretJson(object);
  } catch (error) {
    return oi.fail("De gegeven definitie was niet in het JSON formaat");
  }
}

function interpretJson(definitie: Object): Validation<ol.style.Style> {
  return oi
    .field("versie", oi.str)(definitie)
    .chain(versie => {
      switch (versie) {
        case "awv-v0":
          return oi.chain(
            shortcutStyles, //
            (shortcutJson: Object) => oi.field("definitie", oi.injectFirst(shortcutJson, jsonAwvV0Style))
          )(definitie);
        default:
          return oi.fail(`Json versie '${versie}' wordt niet ondersteund`);
      }
    });
}
