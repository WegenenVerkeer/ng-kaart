import { InjectionToken } from "@angular/core";

import { CrabZoekerConfigData } from "./crab-zoeker.config";
import { GoogleLocatieZoekerConfigData } from "./google-locatie-zoeker.config";

export const ZOEKER_CFG = new InjectionToken<ZoekerConfigData>("ZoekerCfg");

export interface ZoekerConfigData {
  readonly crab?: CrabZoekerConfigData;
  readonly google?: GoogleLocatieZoekerConfigData;
}
