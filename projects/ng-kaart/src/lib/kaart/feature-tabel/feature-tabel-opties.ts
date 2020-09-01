import { option } from "fp-ts";
import { Endomorphism } from "fp-ts/lib/function";

import * as prt from "../kaart-protocol";
import { OptiesOpUiElement } from "../ui-element-opties";

import { FeatureTabelUiSelector } from "./feature-tabel-overzicht.component";

export interface KnopConfiguratie {
  readonly matIcon: string;
  readonly tooltip: string;
  readonly actie: string;
}

export interface FeatureTabelOpties {
  readonly dataHeaderMenuExtraKnoppen: KnopConfiguratie[];
}

export namespace FeatureTabelOpties {
  export const ZetOptiesCmd = (
    opties: Partial<FeatureTabelOpties>
  ): prt.ZetUiElementOpties =>
    prt.ZetUiElementOpties(FeatureTabelUiSelector, opties);

  export const set = (
    opties: Partial<FeatureTabelOpties>
  ): Endomorphism<OptiesOpUiElement> =>
    OptiesOpUiElement.extend(opties)(FeatureTabelUiSelector);

  export const getOption = (
    optiesOpSelector: OptiesOpUiElement
  ): option.Option<FeatureTabelOpties> =>
    OptiesOpUiElement.getOption<FeatureTabelOpties>(FeatureTabelUiSelector)(
      optiesOpSelector
    );
}
