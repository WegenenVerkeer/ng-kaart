import { List } from "immutable";

export interface LijnItem {
  readonly type: "Lijn";
  readonly beschrijving: string;
  readonly kleur: string;
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

export type LegendeItem = LijnItem | BolletjeItem | PolygoonItem;

export interface Legende {
  readonly items: List<LegendeItem>;
}
