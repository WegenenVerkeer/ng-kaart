import { Curried2, Function1, Function2, pipe, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Iso, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";

import { nonEmptyString } from "../util/string";

interface Kleurnaam extends Newtype<{ readonly KLEURNAAM: unique symbol }, string> {}
interface Kleurcode extends Newtype<{ readonly KLEURCODE: unique symbol }, string> {}

const isoKleurnaam: Iso<Kleurnaam, string> = iso<Kleurnaam>();
const isoKleurcode: Iso<Kleurcode, string> = iso<Kleurcode>();
const prismKleurnaam: Prism<string, Kleurnaam> = prism<Kleurnaam>(nonEmptyString);
const prismKleurcode: Prism<string, Kleurcode> = prism<Kleurcode>(s => /^#[a-f\d]{6}([a-f\d]{2})?$/i.test(s)); // optionele transparantie

const toKleurnaam: Function1<string, Option<Kleurnaam>> = prismKleurnaam.getOption;
const toKleurcode: Function1<string, Option<Kleurcode>> = prismKleurcode.getOption;

export interface Kleur {
  naam: Kleurnaam;
  code: Kleurcode;
}

export const Kleur: Curried2<Kleurnaam, Kleurcode, Kleur> = naam => code => ({ naam: naam, code: code });
export const toKleur: Function2<string, string, Option<Kleur>> = (naam, code) => toKleurcode(code).ap(toKleurnaam(naam).map(Kleur));
export const toKleurUnsafe: Function2<string, string, Kleur> = (naam, code) => Kleur(isoKleurnaam.wrap(naam))(isoKleurcode.wrap(code));
export const kleurnaam: Function1<Kleur, Kleurnaam> = kleur => kleur.naam;
export const kleurcode: Function1<Kleur, Kleurcode> = kleur => kleur.code;
export const kleurnaamValue: Function1<Kleur, string> = pipe(kleurnaam, prismKleurnaam.reverseGet);
export const kleurcodeValue: Function1<Kleur, string> = pipe(kleurcode, prismKleurcode.reverseGet);
export const isKleur: Refinement<object, Kleur> = (kleur): kleur is Kleur => kleur.hasOwnProperty("naam") && kleur.hasOwnProperty("code");

export const amber: Kleur = toKleurUnsafe("amber", "#ffc100");
export const blauw: Kleur = toKleurUnsafe("blauw", "#2196f3");
export const cyaan: Kleur = toKleurUnsafe("cyaan", "#00bbd5");
export const geel: Kleur = toKleurUnsafe("geel", "#ffec16");
export const grijs: Kleur = toKleurUnsafe("grijs", "#9d9d9d");
export const groen: Kleur = toKleurUnsafe("groen", "#46af4a");
export const indigo: Kleur = toKleurUnsafe("indigo", "#3d4db7");
export const oranje: Kleur = toKleurUnsafe("oranje", "#ff9800");
export const paars: Kleur = toKleurUnsafe("paars", "#9c1ab1");
export const rood: Kleur = toKleurUnsafe("rood", "#f44336");

/*
export interface Colour {
  red: number;
  green: number;
  blue: number;
  opacity: number;
}

export function fromString(text: string): Option<Colour> {
  return fromNullable(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(text)).chain(comps => {
    try {
      const red = parseInt(comps[1], 16);
      const green = parseInt(comps[2], 16);
      const blue = parseInt(comps[3], 16);
      const opacity = comps.length === 5 ? parseInt(comps[4], 16) : 1;
      return some({ red: red, green: green, blue: blue, opacity: opacity });
    } catch (e) {
      return none;
    }
  });
}

export function toString(colour: Colour): string {
  function paddedHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }
  return "#" + paddedHex(colour.red) + paddedHex(colour.green) + paddedHex(colour.blue) + paddedHex(colour.opacity);
}
*/
