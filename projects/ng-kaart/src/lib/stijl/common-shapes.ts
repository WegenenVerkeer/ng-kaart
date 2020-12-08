import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as ss from "../kaart/stijl-selector";
import { fromValidation } from "../util";

import { Kleur, kleurcodeValue } from "./colour";

export namespace disc {
  export function styleSpec(
    borderColour: Kleur,
    innerColour: Kleur,
    borderWidth: number,
    radius: number
  ): ss.AwvV0StyleSpec {
    return {
      type: "StaticStyle",
      definition: {
        circle: {
          radius: radius,
          fill: { color: kleurcodeValue(innerColour) },
          stroke: { color: kleurcodeValue(borderColour), width: borderWidth },
        },
      },
    };
  }

  export function styleSelector(
    borderColour: Kleur,
    innerColour: Kleur,
    borderWidth: number,
    radius: number
  ): ss.StyleSelector {
    return pipe(
      fromValidation(
        ss.validateAwvV0StyleSpec(
          styleSpec(borderColour, innerColour, borderWidth, radius)
        )
      ),
      option.map(ss.StaticStyle),
      option.getOrElse(() => {
        throw new Error(
          "Slechte stijldefinitie. Dit zou niet mogen kunnen gebeuren."
        );
      })
    );
  }

  export function stylish(
    borderColour: Kleur,
    innerColour: Kleur,
    borderWidth: number,
    radius: number
  ): ss.Stylish {
    return pipe(
      fromValidation(
        ss.validateAwvV0StyleSpec(
          styleSpec(borderColour, innerColour, borderWidth, radius)
        )
      ),
      option.getOrElse(() => {
        throw new Error(
          "Slechte stijldefinitie. Dit zou niet mogen kunnen gebeuren."
        );
      })
    );
  }
}

export namespace solidLine {
  export function styleSpec(
    lineColour: Kleur,
    lineWidth: number
  ): ss.AwvV0StyleSpec {
    return {
      type: "StaticStyle",
      definition: {
        stroke: { color: kleurcodeValue(lineColour), width: lineWidth },
      },
    };
  }

  export function styleSelector(
    lineColour: Kleur,
    lineWidth: number
  ): ss.StyleSelector {
    return pipe(
      fromValidation(
        ss.validateAwvV0StyleSpec(styleSpec(lineColour, lineWidth))
      ),
      option.map(ss.StaticStyle),
      option.getOrElse(() => {
        throw new Error(
          "Slechte stijldefinitie. Dit zou niet mogen kunnen gebeuren."
        );
      })
    );
  }

  export function stylish(lineColour: Kleur, lineWidth: number): ss.Stylish {
    return pipe(
      fromValidation(
        ss.validateAwvV0StyleSpec(styleSpec(lineColour, lineWidth))
      ),
      option.getOrElse(() => {
        throw new Error(
          "Slechte stijldefinitie. Dit zou niet mogen kunnen gebeuren."
        );
      })
    );
  }
}
