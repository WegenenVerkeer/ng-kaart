import { Option } from "fp-ts/lib/Option";
import { List } from "immutable";

export interface LijnItem {
  readonly type: "Lijn";
  readonly beschrijving: string;
  readonly kleur: string;
  readonly achtergrondKleur: Option<string>;
}

export interface BolletjeItem {
  readonly type: "Bolletje";
  readonly beschrijving: string;
  readonly kleur: string;
}

export interface PolygoonItem {
  readonly type: "Polygoon";
  readonly beschrijving: string;
  readonly kleur: string;
}

export interface ImageItem {
  readonly type: "Image";
  readonly beschrijving: string;
  readonly image: string;
}

export type LegendeItem = LijnItem | BolletjeItem | PolygoonItem | ImageItem;

export interface Legende {
  readonly items: List<LegendeItem>;
}

export function Legende(items: LegendeItem[]) {
  return { items: List(items) };
}
