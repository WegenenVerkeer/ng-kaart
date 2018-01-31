import { Either, left, right } from "fp-ts/lib/Either";
import * as array from "fp-ts/lib/Array";
import * as ol from "openlayers";

// Door de beschrijvingsstijl in de kaartcomponent te steken, kunnen ook andere applicaties er gebruik van maken.
// Nog beter is om (op termijn) dit in een afzonderlijke module te steken.
// Best wachten we tot de interface min of meer stabiel is.

// De error zou enkel voor ontwikkelaars mogen zijn. Als ook gebruikers vrij definities mogen opladen,
// dan zou een echte Validation beter zijn.

export type Error = string;
export type Validation<T> = Either<Error, T>;
type Interpreter<T> = (obj: Object) => Validation<T>;

///////////////////////////////////
// Basis functies
//

const fail = <T>(error: Error) => left<Error, T>(error);
const ok = <T>(style: T) => right<Error, T>(style);

const str: Interpreter<string> = (json: Object) => {
  if (typeof json === "string") {
    return ok(json as string);
  } else {
    return fail(`${toString(json)} is geen string`);
  }
};

const num: Interpreter<number> = (json: Object) => {
  if (typeof json === "number") {
    return ok(json as number);
  } else {
    return fail(`${toString(json)} is geen number`);
  }
};

function field<T>(name: string, interpreter: Interpreter<T>): Interpreter<T> {
  return (json: Object) => {
    return json.hasOwnProperty(name) ? interpreter(json[name]) : fail(`'${toString(json)}' heeft geen veld '${name}'`);
  };
}

function at<T>(nest: Array<string>, interpreter: Interpreter<T>): Interpreter<T> {
  return array.fold(
    () => interpreter, //
    (head, tail) => at(tail, field(head, interpreter)),
    array.reverse(nest)
  );
}

function map<A, Value>(f: (a: A) => Value, interpreter: Interpreter<A>): Interpreter<Value> {
  return (json: Object) => interpreter(json).map(f);
}

function map2<A, B, Value>(f: (a: A, b: B) => Value, interpreter1: Interpreter<A>, interpreter2: Interpreter<B>): Interpreter<Value> {
  return (json: Object) => interpreter1(json).chain(a => interpreter2(json).map(b => f(a, b)));
}

function toString(json: Object): string {
  return JSON.stringify(json);
}

///////////////////////////////
// Openlayer types interpreters
//

// Dit is maar een voorbeeld van hoe een stijl er kan uitzien en hoe de parser kan werken. Een echte stijl zal minstens
// wat ingewikkelder zijn.
const jsonAwV0Stroke: Interpreter<ol.style.Stroke> = map2(
  (color: string, width: number) =>
    new ol.style.Stroke({
      color: color,
      width: width
    }),
  field("color", str),
  field("width", num)
);

const jsonAwV0Style: Interpreter<ol.style.Style> = map(
  (stroke: ol.style.Stroke) =>
    new ol.style.Style({
      stroke: stroke
    }),
  at(["definitie", "stroke"], jsonAwV0Stroke)
);

// Vanaf hier zou het iets stabieler moeten zijn
export type StijldefinitieTransformation = Validation<ol.style.Style>;

export function definitieToStyle(formaat: string, definitie: string): StijldefinitieTransformation {
  if (formaat === "json") {
    return jsonDefinitieStringToStyle(definitie);
  } else {
    return fail(`Formaat '${formaat}' wordt niet ondersteund`);
  }
}

function jsonDefinitieStringToStyle(definitie: string): StijldefinitieTransformation {
  try {
    const object = JSON.parse(definitie);
    return jsonInterpreter(object);
  } catch (error) {
    return fail("De gegeven definitie was niet in het JSON formaat");
  }
}

function jsonInterpreter(definitie: Object): Validation<ol.style.Style> {
  return field("versie", str)(definitie).chain(versie => {
    switch (versie) {
      case "awv-v0":
        return jsonAwV0Style(definitie);
      default:
        return fail(`Json versie '${versie}' wordt niet ondersteund`);
    }
  });
}
