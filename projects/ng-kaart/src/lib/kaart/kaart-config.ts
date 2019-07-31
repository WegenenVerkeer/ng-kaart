import { InjectionToken } from "@angular/core";
import { Function1 } from "fp-ts/lib/function";
import * as MobileDetect from "mobile-detect/mobile-detect";
import * as ol from "openlayers";

export const KAART_CFG = new InjectionToken<KaartConfig>("kaartcfg");

export interface EnvParams {
  // hoe nauwkeurig een feature aangeduid moet worden (in px)
  readonly clickHitTolerance: number;
  // hoeveel pixels de muis met ingedrukte knop moet bewegen, of een vinger het scherm raken, vooraleer een pan gebeurt
  readonly moveTolerance: number;
}

export interface KaartConfig {
  readonly tilecache: {
    readonly urls: string[];
  };
  readonly geoserver: {
    readonly urls: string[];
  };
  readonly orthofotomozaiek: {
    readonly naam: string;
    readonly urls: string[];
  };
  readonly srs: string;

  readonly defaults: {
    readonly zoom: number;
    readonly middelpunt: ol.Coordinate;
    readonly grootte: [number | undefined, number | undefined];
    readonly resolutions: number[];
    readonly extent: ol.Extent;
    readonly style: ol.style.Style;
  };

  readonly envParams: {
    readonly desktop: EnvParams;
    readonly mobile: EnvParams;
  };
}

// Alternatief is detect touchscreen van modernizer, maar touch != mobile
const mobileDetect = new MobileDetect(window.navigator.userAgent);

export const envParams: Function1<KaartConfig, EnvParams> = config => config.envParams[mobileDetect.mobile() ? "mobile" : "desktop"];
