import { Curried2, Curried3, Endomorphism, Function1, Function2, pipe, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { contramap, Setoid, setoidString } from "fp-ts/lib/Setoid";
import { Getter, Iso, Lens, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";

import { nonEmptyString, toLowerCaseString } from "../util/string";

// Zie https://github.com/gcanti/newtype-ts, ook wat betreft performantieverlies (in 't kort: geen, is enkel syntactic sugar)
// Kleurnaam is enkel een (compile-time) wrapper rond een niet-lege string
interface Kleurnaam extends Newtype<{ readonly KLEURNAAM: unique symbol }, string> {}
// Kleurcode garandeert dat het een lowercase string is, beginned met # en direct gevolgd door enkel 4 1-byte hex characters
interface Kleurcode extends Newtype<{ readonly KLEURCODE: unique symbol }, string> {}

// type class instances voor Kleurnaam en Kleurcode
const isoKleurnaam: Iso<Kleurnaam, string> = iso<Kleurnaam>();
const isoKleurcode: Iso<Kleurcode, string> = iso<Kleurcode>();
const prismKleurnaam: Prism<string, Kleurnaam> = prism<Kleurnaam>(nonEmptyString);
const prismKleurcode: Prism<string, Kleurcode> = prism<Kleurcode>(s => /^#[a-f\d]{8}$/i.test(s)); // r,g,b,opacity

const toKleurnaam: Function1<string, Option<Kleurnaam>> = prismKleurnaam.getOption;
// ietwat overdreven benaming, maar is enkel voor intern gebruik
const ensureOpacity: Endomorphism<string> = s => s.length < 8 ? s + "ff" : s;
// kleurcode moet lowercase zijn om prism te kunnen passeren. Opacity wordt op 1 gezet indien niet aanwezig
const toKleurcode: Function1<string, Option<Kleurcode>> = pipe(toLowerCaseString, ensureOpacity, prismKleurcode.getOption); 

export interface Kleur {
  naam: Kleurnaam;
  code: Kleurcode;
}


const getComponent: Curried2<number, Kleurcode, number> = pos => code => parseInt(isoKleurcode.unwrap(code).substr(pos * 2 + 1, 2), 16);
const setComponent: Curried3<number, number, Kleurcode, Kleurcode> = pos => value => code => {
  const origRepresentation = isoKleurcode.unwrap(code);
  const paddedHex = c => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  const hexValue = paddedHex(Math.min(255, Math.max(0, value)));
  return isoKleurcode.wrap(origRepresentation.substring(0, pos * 2 + 1) + hexValue + origRepresentation.substr((pos + 1) * 2 + 1));
};
const redGetter: Getter<Kleurcode, number> = new Getter(getComponent(0));
const greenGetter: Getter<Kleurcode, number> = new Getter(getComponent(1));
const blueGetter: Getter<Kleurcode, number> = new Getter(getComponent(2));
const opacityLens: Lens<Kleurcode, number> = new Lens(pipe(getComponent(3), n => n / 255), pipe(n => n * 255, setComponent(3)));
const kleurcodeLens: Lens<Kleur, Kleurcode> = Lens.fromProp("code");

const hexToRGBA: Function1<Kleurcode, string> = code => {
  const [red, green, blue, opacity] = [redGetter, greenGetter, blueGetter, opacityLens].map(getter => getter.get(code));
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

export const Kleur: Curried2<Kleurnaam, Kleurcode, Kleur> = naam => code => ({ naam: naam, code: code });
export const toKleur: Function2<string, string, Option<Kleur>> = (naam, code) => toKleurcode(code).ap(toKleurnaam(naam).map(Kleur));
const fallback: Kleur = Kleur(isoKleurnaam.wrap("zwart"))(isoKleurcode.wrap("#000000ff")); // onveilig, maar geldig bij constructie!
export const toKleurUnsafe: Function2<string, string, Kleur> = (naam, code) => toKleur(naam, code).getOrElse(fallback);
export const kleurnaam: Function1<Kleur, Kleurnaam> = kleur => kleur.naam;
export const kleurcode: Function1<Kleur, Kleurcode> = kleur => kleur.code;
export const kleurnaamValue: Function1<Kleur, string> = pipe(kleurnaam, isoKleurnaam.unwrap);
export const kleurcodeValue: Function1<Kleur, string> = pipe(kleurcode, isoKleurcode.unwrap);
export const kleurRGBAValue: Function1<Kleur, string> = pipe(kleurcode, hexToRGBA);
export const setOpacity: Curried2<number, Kleur, Kleur> = kleurcodeLens.compose(opacityLens).set;

// type class instances voor Kleur
export const isKleur: Refinement<object, Kleur> = (kleur): kleur is Kleur => kleur.hasOwnProperty("naam") && kleur.hasOwnProperty("code");
export const setoidKleurcode: Setoid<Kleurcode> = contramap(isoKleurcode.unwrap, setoidString);
export const setoidKleurOpCode: Setoid<Kleur> = contramap(kleurcode, setoidKleurcode);

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
export const zwart: Kleur = toKleurUnsafe("zwart", "#000000");
export const wit: Kleur = toKleurUnsafe("zwart", "#ffffff");
