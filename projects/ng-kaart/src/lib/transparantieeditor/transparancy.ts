import { Iso, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";

// Type-safe wrapper voor getallen in de range [0.0, 1.0]. In het model laten we dus alle transparanties toe, niet enkel
// de waarden die in de UI gebruikt kunnen worden. Het zou immers best wel eens kunnen zijn dat de opdrachtgevers van
// idee veranderen.
export interface Transparantie extends Newtype<{ readonly TRANSPARANTIE: unique symbol }, number> {}

const isoTransparantie: Iso<Transparantie, number> = iso<Transparantie>();
export const prismTransparantie: Prism<number, Transparantie> = prism<Transparantie>(n => n >= 0 && n <= 1);

export namespace Transparantie {
  // We exposen enkel de 4 mogelijke waarden.
  export const stdTransparanties: Transparantie[] = [0.0, 0.25, 0.5, 0.75].map(isoTransparantie.wrap);
  export const opaak: Transparantie = stdTransparanties[0];
}
