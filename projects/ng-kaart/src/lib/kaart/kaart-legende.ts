import { option } from "fp-ts";

export type LegendeItem = LijnItem | BolletjeItem | PolygoonItem | ImageItem;

export interface LijnItem {
  readonly type: "Lijn";
  readonly beschrijving: string;
  readonly kleur: string;
  readonly achtergrondKleur: option.Option<string>;
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
  readonly items: Array<LegendeItem>;
}

/// ////////////
// Constructors
//

export function Legende(items: LegendeItem[]) {
  return { items: items };
}

export const LijnItem: (
  beschrijving: string,
  kleur: string,
  achtergrondKleur: option.Option<string>
) => LijnItem = (beschrijving, kleur, achtergrondKleur) => ({
  type: "Lijn",
  beschrijving: beschrijving,
  kleur: kleur,
  achtergrondKleur: achtergrondKleur,
});
