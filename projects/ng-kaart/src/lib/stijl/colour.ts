import { eq, option } from "fp-ts";
import { Endomorphism, flow, Refinement } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/function";
import { Getter, Iso, Lens, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";

import { hexByte } from "../util/hex";
import { isNumber } from "../util/number";
import * as ol from "../util/openlayers-compat";
import { nonEmptyString, toLowerCaseString } from "../util/string";

// Zie https://github.com/gcanti/newtype-ts, ook wat betreft performantieverlies (in 't kort: geen, is enkel syntactic sugar)
// Kleurnaam is enkel een (compile-time) wrapper rond een niet-lege string
// Het is de Nederlandse naam van de kleur. Niet bruikbaar om aan de browser te geven als kleurcode.
export type Kleurnaam = Newtype<{ readonly KLEURNAAM: unique symbol }, string>;
// Kleurcode garandeert dat het een lowercase string is, beginned met # en direct gevolgd door juist 4 1-byte hex characters
export type Kleurcode = Newtype<{ readonly KLEURCODE: unique symbol }, string>;

// type class instances voor Kleurnaam en Kleurcode
const isoKleurnaam: Iso<Kleurnaam, string> = iso<Kleurnaam>();
const isoKleurcode: Iso<Kleurcode, string> = iso<Kleurcode>();
const prismKleurnaam: Prism<string, Kleurnaam> = prism<Kleurnaam>(
  nonEmptyString
);
export const prismKleurcode: Prism<string, Kleurcode> = prism<Kleurcode>((s) =>
  /^#[a-f\d]{8}$/i.test(s)
); // r,g,b,opacity

const toKleurnaam: (arg: string) => option.Option<Kleurnaam> =
  prismKleurnaam.getOption;
// ietwat overdreven benaming, maar is enkel voor intern gebruik
const ensureOpacity: Endomorphism<string> = (s) =>
  s.length < 8 ? s + "ff" : s;
// kleurcode moet lowercase zijn om prism te kunnen passeren. Opacity wordt op 1 gezet indien niet aanwezig
const toKleurcode: (arg: string) => option.Option<Kleurcode> = flow(
  toLowerCaseString,
  ensureOpacity,
  prismKleurcode.getOption
);

export interface Kleur {
  naam: Kleurnaam;
  code: Kleurcode;
}

const getComponent: (number) => (Kleurcode) => number = (pos) => (code) =>
  parseInt(isoKleurcode.unwrap(code).substr(pos * 2 + 1, 2), 16);
const setComponent: (number) => (number) => (Kleurcode) => Kleurcode = (
  pos
) => (value) => (code) => {
  const origRepresentation = isoKleurcode.unwrap(code);
  return isoKleurcode.wrap(
    origRepresentation.substring(0, pos * 2 + 1) +
      hexByte(value) +
      origRepresentation.substr((pos + 1) * 2 + 1)
  );
};
const redGetter: Getter<Kleurcode, number> = new Getter(getComponent(0));
const greenGetter: Getter<Kleurcode, number> = new Getter(getComponent(1));
const blueGetter: Getter<Kleurcode, number> = new Getter(getComponent(2));
const opacityLens: Lens<Kleurcode, number> = new Lens(
  flow(getComponent(3), (n) => n / 255),
  flow((n) => n * 255, setComponent(3))
);
const kleurcodeLens: Lens<Kleur, Kleurcode> = Lens.fromProp<Kleur>()("code");

const hexToRGBA: (arg: Kleurcode) => string = (code) => {
  const [red, green, blue, opacity] = [
    redGetter,
    greenGetter,
    blueGetter,
    opacityLens,
  ].map((getter) => getter.get(code));
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

// constructors en accessors
export const Kleur: (Kleurnaam) => (Kleurcode) => Kleur = (naam) => (code) => ({
  naam: naam,
  code: code,
});
export const toKleur: (naam: string, code: string) => option.Option<Kleur> = (
  naam,
  code
) => option.ap(toKleurcode(code))(pipe(toKleurnaam(naam), option.map(Kleur)));
const fallback: Kleur = Kleur(isoKleurnaam.wrap("zwart"))(
  isoKleurcode.wrap("#000000ff")
); // onveilig, maar geldig bij constructie!
export const toKleurUnsafe: (naam: string, code: string) => Kleur = (
  naam,
  code
) =>
  pipe(
    toKleur(naam, code),
    option.getOrElse(() => fallback)
  );
export const kleurnaam: (arg: Kleur) => Kleurnaam = (kleur) => kleur.naam;
export const kleurcode: (arg: Kleur) => Kleurcode = (kleur) => kleur.code;
export const kleurnaamValue: (arg: Kleur) => string = flow(
  kleurnaam,
  isoKleurnaam.unwrap
);
export const kleurcodeValue: (arg: Kleur) => string = flow(
  kleurcode,
  isoKleurcode.unwrap
);
export const kleurRGBAValue: (arg: Kleur) => string = flow(
  kleurcode,
  hexToRGBA
);
export const setOpacity: (number) => (Kleur) => Kleur = kleurcodeLens.compose(
  opacityLens
).set;

// type class instances voor Kleur
export const isKleur: Refinement<object, Kleur> = (kleur): kleur is Kleur =>
  kleur.hasOwnProperty("naam") && kleur.hasOwnProperty("code");
export const setoidKleurcode: eq.Eq<Kleurcode> = pipe(
  eq.eqString,
  eq.contramap(isoKleurcode.unwrap)
);
export const setoidKleurOpCode: eq.Eq<Kleur> = pipe(
  setoidKleurcode,
  eq.contramap(kleurcode)
);

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
export const transparant: Kleur = toKleurUnsafe("transparant", "#00000000");

export const onbekendGrijs: Kleur = toKleurUnsafe("onbekend", "#6d6d6d");
export const donkergrijs: Kleur = toKleurUnsafe("donkergrijs", "#404040");
export const transparantgrijs: Kleur = toKleurUnsafe(
  "transparantgrijs",
  "#0000000f"
);
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
  zachtgrijs,
];
const extraKleuren = [zwart, wit, kastanje];

interface KleurLookup {
  [k: string]: Kleur;
}

const kleurByCode: KleurLookup = standaardKleuren
  .concat(extraKleuren)
  .reduce(
    (lookup, kleur) => ({ ...lookup, [kleurcodeValue(kleur)]: kleur }),
    {}
  );

// Probeer een kleurcode om te zetten naar een kleur. Faal als de code niet bekend is
export const stringToKleur: (string) => option.Option<Kleur> = (txt) =>
  option.fromNullable(kleurByCode[txt]);

// Converteer vanaf open layers
export const olToKleur: (
  colorlike: ol.Color | string
) => option.Option<Kleur> = (colorlike) => {
  if (typeof colorlike === "string") {
    // Als het een kleurnaam is, dan kunnen we er helaas niks mee doen. In een overgangsfase zou dat wel nuttig
    // kunnen zijn, maar uiteindelijk gaan we alle kleuren genereren.
    return toKleur("afgeleid", colorlike);
  } else if (
    Array.isArray(colorlike) &&
    colorlike.filter(isNumber).length === 4
  ) {
    return toKleur("afgeleid", "#" + colorlike.map(hexByte).join());
  } else {
    // Uint8Array en Uint8ClampedArray ondersteunen we niet
    return option.none;
  }
};
