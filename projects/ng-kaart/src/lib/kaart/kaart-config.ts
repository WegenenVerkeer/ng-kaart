import { InjectionToken } from "@angular/core";
import { Function1 } from "fp-ts/lib/function";

import * as ol from "../util/openlayers-compat";

export const KAART_CFG = new InjectionToken<KaartConfig>("kaartcfg");

export interface EnvParams {
  // hoe nauwkeurig een feature aangeduid moet worden (in px)
  readonly clickHitTolerance: number;
  // hoeveel pixels de muis met ingedrukte knop moet bewegen, of een vinger het scherm raken, vooraleer een pan gebeurt
  readonly moveTolerance: number;
  // hoe de tabellen standaard weergegeven worden. Een number om geen te diepe en evt circulaire dependency te maken.
  // 1 = compact, 2 (en alles anders) = comfortable
  readonly initialLayoutMode: number;
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

// pointer: coarse -> The primary input mechanism of the device includes a pointing device of limited accuracy.
export const mobile =
  window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

export const envParams: Function1<KaartConfig, EnvParams> = (config) =>
  config.envParams[mobile ? "mobile" : "desktop"];
