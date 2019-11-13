import { Endomorphism } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";

import * as prt from "../kaart-protocol";
import { OptiesOpUiElement } from "../ui-element-opties";

export const IdentifyUiSelector = "Identify";

export interface IdentifyOpties {
  readonly identifyOnderdrukt: boolean;
}

export const ZetIdentifyOptiesCmd = (opties: Partial<IdentifyOpties>): prt.ZetUiElementOpties =>
  prt.ZetUiElementOpties(IdentifyUiSelector, opties);

export const modifyIdentifyOpties = (opties: Partial<IdentifyOpties>): Endomorphism<Map<string, object>> =>
  OptiesOpUiElement.extend(opties)(IdentifyUiSelector);

export const getIdentifyOpties = (optiesOpSelector: Map<string, object>): Option<IdentifyOpties> =>
  OptiesOpUiElement.get<IdentifyOpties>(IdentifyUiSelector)(optiesOpSelector);
