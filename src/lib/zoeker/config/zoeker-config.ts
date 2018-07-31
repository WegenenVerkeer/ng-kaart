import { InjectionToken } from "@angular/core";

import { GoogleWdbLocatieZoekerConfigData } from "./zoeker-config-google-wdb.config";
import { LocatorServicesConfigData } from "./zoeker-config-locator-services.config";

export const ZOEKER_CFG = new InjectionToken<ZoekerConfigData>("ZoekerCfg");

export interface ZoekerConfigData {
  // Dit is een json-string van een array van number,string tuples,
  // omdat de angular aot compiler geen complexe config toelaat!!!!
  readonly bronVolgorde?: string;
  readonly locatorServices?: LocatorServicesConfigData;
  readonly googleWdb?: GoogleWdbLocatieZoekerConfigData;
}
