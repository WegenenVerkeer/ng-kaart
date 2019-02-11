import * as ss from "../kaart/stijl-selector";
import { fromValidation } from "../util";

import { Kleur, kleurcodeValue } from "./colour";

export namespace disc {
  export function styleSpec(borderColour: Kleur, innerColour: Kleur, borderWidth: number, radius: number): ss.AwvV0StyleSpec {
    return {
      type: "StaticStyle",
      definition: {
        circle: {
          radius: radius,
          fill: { color: kleurcodeValue(innerColour) },
          stroke: { color: kleurcodeValue(borderColour), width: borderWidth }
        }
      }
    };
  }

  export function styleSelector(borderColour: Kleur, innerColour: Kleur, borderWidth: number, radius: number): ss.StyleSelector {
    return fromValidation(ss.validateAwvV0StyleSpec(styleSpec(borderColour, innerColour, borderWidth, radius)))
      .map(ss.StaticStyle)
      .getOrElseL(() => {
        throw new Error("Slechte stijldefinitie. Dit zou niet mogen kunnen gebeuren.");
      });
  }

  export function stylish(borderColour: Kleur, innerColour: Kleur, borderWidth: number, radius: number): ss.Stylish {
    return fromValidation(ss.validateAwvV0StyleSpec(styleSpec(borderColour, innerColour, borderWidth, radius))).getOrElseL(() => {
      throw new Error("Slechte stijldefinitie. Dit zou niet mogen kunnen gebeuren.");
    });
  }
}
