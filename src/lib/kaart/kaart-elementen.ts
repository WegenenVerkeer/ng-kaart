import { List } from "immutable";
import * as ol from "openlayers";

export const WmsType = "LaagType.WMS";
export type WmsType = "LaagType.WMS";
export const VectorType = "LaagType.Vector";
export type VectorType = "LaagType.Vector";
export const BlancoType = "LaagType.Blanco";
export type BlancoType = "LaagType.Blanco";
export type LaagType = WmsType | VectorType | BlancoType;

export interface WmsLaag {
  readonly type: WmsType;
  readonly titel: string;
  readonly naam: string;
  readonly dekkend: boolean;
  readonly urls: List<string>;
  readonly extent?: ol.Extent;
  readonly versie?: string;
}

export interface VectorLaag {
  readonly type: VectorType;
  readonly titel: string;
  readonly source: ol.source.Vector;
  readonly style: ol.style.Style;
  readonly selecteerbaar: boolean;
}

export interface BlancoLaag {
  readonly type: BlancoType;
  readonly titel: string;
}

export type Laag = WmsLaag | VectorLaag | BlancoLaag;

export function isWmsLaag(laag: Laag): boolean {
  return laag.type === WmsType;
}

export function isBlancoLaag(laag: Laag): boolean {
  return laag.type === BlancoType;
}
