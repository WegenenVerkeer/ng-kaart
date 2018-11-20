import { Function3 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { List } from "immutable";

export type LegendeItem = LijnItem | BolletjeItem | PolygoonItem | ImageItem;

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

export interface Legende {
  readonly items: List<LegendeItem>;
}

///////////////
// Constructors
//

export function Legende(items: LegendeItem[]) {
  return { items: List(items) };
}

export const LijnItem: Function3<string, string, Option<string>, LijnItem> = (beschrijving, kleur, achtergrondKleur) => ({
  type: "Lijn",
  beschrijving: beschrijving,
  kleur: kleur,
  achtergrondKleur: achtergrondKleur
});
