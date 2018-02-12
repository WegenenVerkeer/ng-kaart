import * as ol from "openlayers";

import { Validation, fail, str, field } from "./json-object-interpreting";
import { jsonAwvV0Style } from "./json-awv0-interpreter";

// Door de beschrijvingsstijl in de kaartcomponent te steken, kunnen ook andere applicaties er gebruik van maken.
// Nog beter is om (op termijn) dit in een afzonderlijke module te steken.
// Best wachten we tot de interface min of meer stabiel is.

// Vanaf hier zou het iets stabieler moeten zijn
export type StijldefinitieTransformation = Validation<ol.style.Style>;

export function definitieToStyle(formaat: string, definitieText: string): StijldefinitieTransformation {
  if (formaat === "json") {
    return jsonDefinitieStringToStyle(definitieText);
  } else {
    return fail(`Formaat '${formaat}' wordt niet ondersteund`);
  }
}

function jsonDefinitieStringToStyle(definitieText: string): StijldefinitieTransformation {
  try {
    const object = JSON.parse(definitieText);
    return interpretJson(object);
  } catch (error) {
    return fail("De gegeven definitie was niet in het JSON formaat");
  }
}

function interpretJson(definitie: Object): Validation<ol.style.Style> {
  return field("versie", str)(definitie).chain(versie => {
    switch (versie) {
      case "awv-v0":
        return field("definitie", jsonAwvV0Style)(definitie);
      default:
        return fail(`Json versie '${versie}' wordt niet ondersteund`);
    }
  });
}
