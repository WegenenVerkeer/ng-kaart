import { List } from "immutable";
import * as ol from "openlayers";

export enum ElementType {
  WMSLAAG,
  VECTORLAAG
}

export interface KaartElement {
  readonly type: ElementType;
}

export interface WmsLaag extends KaartElement {
  readonly titel: string;
  readonly naam: string;
  readonly dekkend: boolean;
  readonly extent?: ol.Extent;
  readonly urls?: List<string>;
  readonly versie?: string;
}

export interface VectorLaag extends KaartElement {
  readonly titel: string;
  readonly dekkend: boolean;
  readonly source: ol.source.Vector;
  readonly style: ol.style.Style;
  readonly selecteerbaar: boolean;
}

export type Laag = WmsLaag | VectorLaag;
