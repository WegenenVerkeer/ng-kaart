import { option } from "fp-ts";
import { Endomorphism } from "fp-ts/lib/function";

import * as prt from "../kaart-protocol";
import { OptiesOpUiElement } from "../ui-element-opties";

export const IdentifyUiSelector = "Identify";

export interface IdentifyOpties {
  readonly identifyOnderdrukt: boolean;
}

export namespace IdentifyOpties {
  export const ZetOptiesCmd = (
    opties: Partial<IdentifyOpties>
  ): prt.ZetUiElementOpties =>
    prt.ZetUiElementOpties(IdentifyUiSelector, opties);

  export const set = (
    opties: Partial<IdentifyOpties>
  ): Endomorphism<OptiesOpUiElement> =>
    OptiesOpUiElement.extend(opties)(IdentifyUiSelector);

  export const getOption = (
    optiesOpSelector: OptiesOpUiElement
  ): option.Option<IdentifyOpties> =>
    OptiesOpUiElement.getOption<IdentifyOpties>(IdentifyUiSelector)(
      optiesOpSelector
    );
}
