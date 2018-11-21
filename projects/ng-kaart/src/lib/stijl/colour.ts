import * as array from "fp-ts/lib/Array";
import { concat, Curried2, Curried3, Endomorphism, Function1, Function2, pipe, Refinement } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { contramap, Setoid, setoidString } from "fp-ts/lib/Setoid";
import { Getter, Iso, Lens, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";
import * as ol from "openlayers";
import { isNumber } from "util";

import { hexByte } from "../util/hex";
import { nonEmptyString, toLowerCaseString } from "../util/string";

// Zie https://github.com/gcanti/newtype-ts, ook wat betreft performantieverlies (in 't kort: geen, is enkel syntactic sugar)
// Kleurnaam is enkel een (compile-time) wrapper rond een niet-lege string
// Het is de Nederlandse naam van de kleur. Niet bruikbaar om aan de browser te geven als kleurcode.
export interface Kleurnaam extends Newtype<{ readonly KLEURNAAM: unique symbol }, string> {}
// Kleurcode garandeert dat het een lowercase string is, beginned met # en direct gevolgd door juist 4 1-byte hex characters
export interface Kleurcode extends Newtype<{ readonly KLEURCODE: unique symbol }, string> {}

// type class instances voor Kleurnaam en Kleurcode
const isoKleurnaam: Iso<Kleurnaam, string> = iso<Kleurnaam>();
const isoKleurcode: Iso<Kleurcode, string> = iso<Kleurcode>();
const prismKleurnaam: Prism<string, Kleurnaam> = prism<Kleurnaam>(nonEmptyString);
export const prismKleurcode: Prism<string, Kleurcode> = prism<Kleurcode>(s => /^#[a-f\d]{8}$/i.test(s)); // r,g,b,opacity

const toKleurnaam: Function1<string, Option<Kleurnaam>> = prismKleurnaam.getOption;
// ietwat overdreven benaming, maar is enkel voor intern gebruik
const ensureOpacity: Endomorphism<string> = s => (s.length < 8 ? s + "ff" : s);
// kleurcode moet lowercase zijn om prism te kunnen passeren. Opacity wordt op 1 gezet indien niet aanwezig
const toKleurcode: Function1<string, Option<Kleurcode>> = pipe(
  toLowerCaseString,
  ensureOpacity,
  prismKleurcode.getOption
);

export interface Kleur {
  naam: Kleurnaam;
  code: Kleurcode;
}

const getComponent: Curried2<number, Kleurcode, number> = pos => code => parseInt(isoKleurcode.unwrap(code).substr(pos * 2 + 1, 2), 16);
const setComponent: Curried3<number, number, Kleurcode, Kleurcode> = pos => value => code => {
  const origRepresentation = isoKleurcode.unwrap(code);
  return isoKleurcode.wrap(origRepresentation.substring(0, pos * 2 + 1) + hexByte(value) + origRepresentation.substr((pos + 1) * 2 + 1));
};
const redGetter: Getter<Kleurcode, number> = new Getter(getComponent(0));
const greenGetter: Getter<Kleurcode, number> = new Getter(getComponent(1));
const blueGetter: Getter<Kleurcode, number> = new Getter(getComponent(2));
const opacityLens: Lens<Kleurcode, number> = new Lens(
  pipe(
    getComponent(3),
    n => n / 255
  ),
  pipe(
    n => n * 255,
    setComponent(3)
  )
);
const kleurcodeLens: Lens<Kleur, Kleurcode> = Lens.fromProp("code");

const hexToRGBA: Function1<Kleurcode, string> = code => {
  const [red, green, blue, opacity] = [redGetter, greenGetter, blueGetter, opacityLens].map(getter => getter.get(code));
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

// constructors en accessors
export const Kleur: Curried2<Kleurnaam, Kleurcode, Kleur> = naam => code => ({ naam: naam, code: code });
export const toKleur: Function2<string, string, Option<Kleur>> = (naam, code) => toKleurcode(code).ap(toKleurnaam(naam).map(Kleur));
const fallback: Kleur = Kleur(isoKleurnaam.wrap("zwart"))(isoKleurcode.wrap("#000000ff")); // onveilig, maar geldig bij constructie!
export const toKleurUnsafe: Function2<string, string, Kleur> = (naam, code) => toKleur(naam, code).getOrElse(fallback);
export const kleurnaam: Function1<Kleur, Kleurnaam> = kleur => kleur.naam;
export const kleurcode: Function1<Kleur, Kleurcode> = kleur => kleur.code;
export const kleurnaamValue: Function1<Kleur, string> = pipe(
  kleurnaam,
  isoKleurnaam.unwrap
);
export const kleurcodeValue: Function1<Kleur, string> = pipe(
  kleurcode,
  isoKleurcode.unwrap
);
export const kleurRGBAValue: Function1<Kleur, string> = pipe(
  kleurcode,
  hexToRGBA
);
export const setOpacity: Curried2<number, Kleur, Kleur> = kleurcodeLens.compose(opacityLens).set;

// type class instances voor Kleur
export const isKleur: Refinement<object, Kleur> = (kleur): kleur is Kleur => kleur.hasOwnProperty("naam") && kleur.hasOwnProperty("code");
export const setoidKleurcode: Setoid<Kleurcode> = contramap(isoKleurcode.unwrap, setoidString);
export const setoidKleurOpCode: Setoid<Kleur> = contramap(kleurcode, setoidKleurcode);

// Onze vaste kleuren
export const groen: Kleur = toKleurUnsafe("groen", "#46af4a");
export const geel: Kleur = toKleurUnsafe("geel", "#ffec16");
export const rood: Kleur = toKleurUnsafe("rood", "#f44336");
export const indigo: Kleur = toKleurUnsafe("indigo", "#3d4db7");
export const bruin: Kleur = toKleurUnsafe("bruin", "#7a5547");
export const lichtgroen: Kleur = toKleurUnsafe("lichtgroen", "#88d440");
export const amber: Kleur = toKleurUnsafe("amber", "#ffc100");
export const roze: Kleur = toKleurUnsafe("roze", "#eb1460");
export const blauw: Kleur = toKleurUnsafe("blauw", "#2196f3");
export const grijs: Kleur = toKleurUnsafe("grijs", "#9d9d9d");
export const limoengroen: Kleur = toKleurUnsafe("limoengroen", "#ccdd1e");
export const oranje: Kleur = toKleurUnsafe("oranje", "#ff9800");
export const paars: Kleur = toKleurUnsafe("paars", "#9c1ab1");
export const lichtblauw: Kleur = toKleurUnsafe("lichtblauw", "#03a9f4");
export const blauwgrijs: Kleur = toKleurUnsafe("blauwgrijs", "#5e7c8b");
export const groenblauw: Kleur = toKleurUnsafe("groenblauw", "#009687");
export const donkeroranje: Kleur = toKleurUnsafe("donkeroranje", "#ff5505");
export const donkerpaars: Kleur = toKleurUnsafe("donkerpaars", "#6633b9");
export const cyaan: Kleur = toKleurUnsafe("cyaan", "#00bbd5");
export const grijsblauw: Kleur = toKleurUnsafe("grijsblauw", "#455a64");
export const grasgroen: Kleur = toKleurUnsafe("grasgroen", "#388e3c");
export const zalm: Kleur = toKleurUnsafe("zalm", "#ff6e40");
export const bordeau: Kleur = toKleurUnsafe("bordeau", "#c2185b");
export const turquoise: Kleur = toKleurUnsafe("turquoise", "#0097a7");
export const taupe: Kleur = toKleurUnsafe("taupe", "#8d6e63");
export const donkergroen: Kleur = toKleurUnsafe("donkergroen", "#1b5e20");
export const donkergeel: Kleur = toKleurUnsafe("donkergeel", "#ffd740");
export const donkerrood: Kleur = toKleurUnsafe("donkerrood", "#d50000");
export const donkerblauw: Kleur = toKleurUnsafe("donkerblauw", "#1a237e");
export const zwartig: Kleur = toKleurUnsafe("zwart", "#212121");
export const zachtgroen: Kleur = toKleurUnsafe("zachtgroen", "#81c784");
export const zachtgeel: Kleur = toKleurUnsafe("zachtgeel", "#fff59d");
export const zachtrood: Kleur = toKleurUnsafe("zachtrood", "#ef5350");
export const zachtblauw: Kleur = toKleurUnsafe("zachtblauw", "#7986cb");
export const zachtgrijs: Kleur = toKleurUnsafe("zachtgrijs", "#cfd8dc");
export const zwart: Kleur = toKleurUnsafe("zwart", "#000000");
export const wit: Kleur = toKleurUnsafe("zwart", "#ffffff");

export const onbekendGrijs: Kleur = toKleurUnsafe("onbekend", "#6d6d6d");
const kastanje: Kleur = toKleurUnsafe("kastanje", " #800000"); // wordt veel gebruikt

export const standaardKleuren = [
  groen,
  geel,
  rood,
  indigo,
  bruin,
  lichtgroen,
  amber,
  roze,
  blauw,
  grijs,
  limoengroen,
  oranje,
  paars,
  lichtblauw,
  blauwgrijs,
  groenblauw,
  donkeroranje,
  donkerpaars,
  cyaan,
  grijsblauw,
  grasgroen,
  zalm,
  bordeau,
  turquoise,
  taupe,
  donkergroen,
  donkergeel,
  donkerrood,
  donkerblauw,
  zwartig,
  zachtgroen,
  zachtgeel,
  zachtrood,
  zachtblauw,
  zachtgrijs
];
const extraKleuren = [zwart, wit, kastanje];

interface KleurLookup {
  [k: string]: Kleur;
}

const kleurByCode: KleurLookup = concat(standaardKleuren, extraKleuren).reduce(
  (lookup, kleur) => ({ ...lookup, [kleurcodeValue(kleur)]: kleur }),
  {}
);

// Probeer een kleurcode om te zetten naar een kleur. Faal als de code niet bekend is
export const stringToKleur: Function1<string, Option<Kleur>> = txt => fromNullable(kleurByCode[txt]);

// Converteer vanaf open layers
export const olToKleur: Function1<ol.Color | string, Option<Kleur>> = colorlike => {
  if (typeof colorlike === "string") {
    // Als het een kleurnaam is, dan kunnen we er helaas niks mee doen. In een overgangsfase zou dat wel nuttig
    // kunnen zijn, maar uiteindelijk gaan we alle kleuren genereren.
    return toKleur("afgeleid", colorlike);
  } else if (Array.isArray(colorlike) && colorlike.filter(isNumber).length === 4) {
    return toKleur("afgeleid", "#" + colorlike.map(hexByte).join());
  } else {
    // Uint8Array en Uint8ClampedArray ondersteunen we niet
    return none;
  }
};
