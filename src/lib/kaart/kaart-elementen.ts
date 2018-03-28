import { List } from "immutable";
import * as ol from "openlayers";
import { Option } from "fp-ts/lib/Option";

export const SingleTileWmsType = "LaagType.SingleTileWms";
export type SingleTileWmsType = "LaagType.SingleTileWms";
export const TiledWmsType = "LaagType.TiledWms";
export type TiledWmsType = "LaagType.TiledWms";
export const VectorType = "LaagType.Vector";
export type VectorType = "LaagType.Vector";
export const BlancoType = "LaagType.Blanco";
export type BlancoType = "LaagType.Blanco";
export type LaagType = SingleTileWmsType | TiledWmsType | VectorType | BlancoType;

export interface StaticStyle {
  readonly type: "StaticStyle";
  readonly style: ol.style.Style;
}

export interface DynamicStyle {
  readonly type: "DynamicStyle";
  readonly styleFunction: ol.StyleFunction;
}

export type StyleSelector = StaticStyle | DynamicStyle;

export type AchtergrondLaag = WmsLaag | BlancoLaag;

export interface WmsLaag {
  readonly type: SingleTileWmsType | TiledWmsType;
  readonly titel: string;
  readonly naam: string;
  readonly urls: List<string>;
  readonly versie: Option<string>;
  readonly tileSize: Option<number>;
  readonly format: Option<string>;
}

export interface VectorLaag {
  readonly type: VectorType;
  readonly titel: string;
  readonly source: ol.source.Vector;
  readonly styleSelector: Option<StyleSelector>;
  readonly selecteerbaar: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;
}

export interface BlancoLaag {
  readonly type: BlancoType;
  readonly titel: string;
}

export type Laag = WmsLaag | VectorLaag | BlancoLaag;

export function isWmsLaag(laag: Laag): boolean {
  return laag.type === SingleTileWmsType || laag.type === TiledWmsType;
}

export function isBlancoLaag(laag: Laag): boolean {
  return laag.type === BlancoType;
}

export function StaticStyle(style: ol.style.Style): StyleSelector {
  return {
    type: "StaticStyle",
    style: style
  };
}

export function DynamicStyle(styleFunction: ol.StyleFunction): StyleSelector {
  return {
    type: "DynamicStyle",
    styleFunction: styleFunction
  };
}
