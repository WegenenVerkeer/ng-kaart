import { InjectionToken } from "@angular/core";
import { Map } from "immutable";

import { GoogleWdbLocatieZoekerConfigData } from "./zoeker-config-google-wdb.config";
import { LocatorServicesConfigData } from "./zoeker-config-locator-services.config";

export const ZOEKER_CFG = new InjectionToken<ZoekerConfigData>("ZoekerCfg");

export interface ZoekerConfigData {
  readonly bronVolgorde?: Map<number, RegExp>;
  readonly locatorServices?: LocatorServicesConfigData;
  readonly googleWdb?: GoogleWdbLocatieZoekerConfigData;
}
