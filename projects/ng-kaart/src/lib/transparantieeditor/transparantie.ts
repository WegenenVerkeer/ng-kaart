import { Endomorphism, Function1, pipe, Predicate } from "fp-ts/lib/function";
import { Iso, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";

import { PartialFunction1 } from "../util/function";

// Type-safe wrapper voor getallen in de range [0.0, 1.0]. In het model laten we dus alle transparanties toe, niet enkel
// de waarden die in de UI gebruikt kunnen worden. Het zou immers best wel eens kunnen zijn dat de opdrachtgevers van
// idee veranderen.
export type Transparantie = Newtype<
  { readonly TRANSPARANTIE: unique symbol },
  number
>;

// Net zoals Transparantie een wrapper in de range [0.0, 1.0], maar dan met de inverse interpretatie.
export type Opaciteit = Newtype<
  { readonly TRANSPARANTIE: unique symbol },
  number
>;

const isoTransparantie: Iso<Transparantie, number> = iso<Transparantie>();
const prismTransparantie: Prism<number, Transparantie> = prism<Transparantie>(
  (n) => n >= 0 && n <= 1
);

const isoOpaciteit: Iso<Opaciteit, number> = iso<Opaciteit>();
const prismOpaciteit: Prism<number, Opaciteit> = prism<Opaciteit>(
  (n) => n >= 0 && n <= 1
);

const clampToUnit: Endomorphism<number> = (value) =>
  Math.max(Math.min(value, 1), 0);
export namespace Transparantie {
  export const opaak: Transparantie = isoTransparantie.wrap(0);

  export const toOpaciteit: Function1<Transparantie, Opaciteit> = (
    transparantie
  ) => isoOpaciteit.wrap(1 - toNumber(transparantie));

  export const fromNumber: PartialFunction1<number, Transparantie> =
    prismTransparantie.getOption;
  export const fromNumberClamped: Function1<number, Transparantie> = pipe(
    clampToUnit,
    isoTransparantie.wrap
  );
  export const toNumber: Function1<Transparantie, number> =
    isoTransparantie.unwrap;

  export const isOpaak: Predicate<Transparantie> = (transparantie) =>
    transparantie === opaak;
  export const isTransparant: Predicate<Transparantie> = (transparantie) =>
    transparantie !== opaak;
}

export namespace Opaciteit {
  export const opaak: Opaciteit = isoOpaciteit.wrap(1);

  export const toTransparantie: Function1<Opaciteit, Transparantie> = (
    opaciteit
  ) => isoTransparantie.wrap(1 - toNumber(opaciteit));
  export const fromNumberClamped: Function1<number, Opaciteit> = pipe(
    clampToUnit,
    isoOpaciteit.wrap
  );

  export const fromNumber: PartialFunction1<number, Opaciteit> =
    prismOpaciteit.getOption;
  export const toNumber: Function1<Opaciteit, number> = isoOpaciteit.unwrap;
}
