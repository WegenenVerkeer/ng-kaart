import { option } from "fp-ts";
import { Endomorphism } from "fp-ts/lib/function";

import * as prt from "../kaart-protocol";
import { OptiesOpUiElement } from "../ui-element-opties";

export const BevraagKaartUiSelector = "Bevraagkaart";

export interface MeterUnit {
  readonly type: "Meter";
  readonly waarde: number;
}
export function MeterUnit(waarde: number): MeterUnit {
  return {
    type: "Meter",
    waarde: waarde,
  };
}

export interface PixelUnit {
  readonly type: "Pixel";
  readonly waarde: number;
}
export function PixelUnit(waarde: number): PixelUnit {
  return {
    type: "Pixel",
    waarde: waarde,
  };
}

export type UnitType = "Meter" | "Pixel";
export type ZoekAfstand = MeterUnit | PixelUnit;

export function ZoekAfstand(type: UnitType, waarde: number): ZoekAfstand {
  switch (type) {
    case "Pixel":
      return PixelUnit(waarde);
    default:
      return MeterUnit(waarde);
  }
}

export interface BevraagKaartOpties {
  readonly zoekAfstand: ZoekAfstand;
  readonly kaartBevragenOnderdrukt: boolean;
  readonly infoServiceOnderdrukt: boolean;
  readonly onderdrukInfoBoodschappen: boolean;
}

export namespace BevraagKaartOpties {
  export const ZetOptiesCmd = (
    opties: Partial<BevraagKaartOpties>
  ): prt.ZetUiElementOpties =>
    prt.ZetUiElementOpties(BevraagKaartUiSelector, opties);

  export const set = (
    opties: Partial<BevraagKaartOpties>
  ): Endomorphism<OptiesOpUiElement> =>
    OptiesOpUiElement.extend(opties)(BevraagKaartUiSelector);

  export const getOption = (
    optiesOpSelector: OptiesOpUiElement
  ): option.Option<BevraagKaartOpties> =>
    OptiesOpUiElement.getOption<BevraagKaartOpties>(BevraagKaartUiSelector)(
      optiesOpSelector
    );
}
