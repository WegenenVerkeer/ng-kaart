import { option } from "fp-ts";
import { Endomorphism } from "fp-ts/lib/function";

import * as prt from "../kaart-protocol";
import { OptiesOpUiElement } from "../ui-element-opties";

export const ServiceNowUiSelector = "ServiceNow";

export interface ServiceNowOpties {
  readonly serviceNowCasesActief: boolean;
}

export namespace ServiceNowOpties {
  export const ZetOptiesCmd = (
    opties: Partial<ServiceNowOpties>
  ): prt.ZetUiElementOpties =>
    prt.ZetUiElementOpties(ServiceNowUiSelector, opties);

  export const set = (
    opties: Partial<ServiceNowOpties>
  ): Endomorphism<OptiesOpUiElement> =>
    OptiesOpUiElement.extend(opties)(ServiceNowUiSelector);

  export const getOption = (
    optiesOpSelector: OptiesOpUiElement
  ): option.Option<ServiceNowOpties> =>
    OptiesOpUiElement.getOption<ServiceNowOpties>(ServiceNowUiSelector)(
      optiesOpSelector
    );
}
