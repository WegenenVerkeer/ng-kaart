import { Function1, Predicate } from "fp-ts/lib/function";
import { Iso, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";

import { PartialFunction1 } from "../util/function";

// Type-safe wrapper voor getallen in de range [0.0, 1.0]. In het model laten we dus alle transparanties toe, niet enkel
// de waarden die in de UI gebruikt kunnen worden. Het zou immers best wel eens kunnen zijn dat de opdrachtgevers van
// idee veranderen.
export interface Transparantie extends Newtype<{ readonly TRANSPARANTIE: unique symbol }, number> {}

const isoTransparantie: Iso<Transparantie, number> = iso<Transparantie>();
export const prismTransparantie: Prism<number, Transparantie> = prism<Transparantie>(n => n >= 0 && n <= 1);

export namespace Transparantie {
  // We exposen enkel de 4 mogelijke waarden.
  export const opaak: Transparantie = isoTransparantie.wrap(0);

  export const fromNumber: PartialFunction1<number, Transparantie> = prismTransparantie.getOption;
  export const toNumber: Function1<Transparantie, number> = isoTransparantie.unwrap;

  export const isOpaak: Predicate<Transparantie> = transparantie => transparantie === opaak;
  export const isTransparant: Predicate<Transparantie> = transparantie => transparantie !== opaak;
}
