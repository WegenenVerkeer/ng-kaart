import { InjectionToken } from "@angular/core";
import * as ol from "openlayers";

export const KAART_CFG = new InjectionToken<KaartConfig>("kaartcfg");

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
    zoom: number;
    middelpunt: ol.Coordinate;
    grootte: [number | undefined, number | undefined];
    resolutions: [number];
    extent: ol.Extent;
  };
}
