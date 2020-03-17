import { array, option } from "fp-ts";
import { Curried2, Endomorphism, FunctionN, not } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { DateTime } from "luxon";
import { Lens } from "monocle-ts";

import * as arrays from "../../util/arrays";
import { fromTimestamp, parseDate } from "../../util/date-time";
import { Feature, FeatureWithIdAndLaagnaam } from "../../util/feature";
import { PartialFunction2 } from "../../util/function";
import { Properties } from "../../util/geojson-types";
import * as ol from "../../util/openlayers-compat";
import * as ke from "../kaart-elementen";
import { kaartLogger } from "../log";

export type ValueType = string | number | boolean | DateTime;

// Zou kunnen new-type zijn. Afwachten of er nog properties nuttig zijn
export interface Field {
  readonly maybeValue: Option<ValueType>;
  readonly maybeLink: Option<string>;
}

export type Fields = Record<string, Field>;

export interface Row {
  readonly feature: FeatureWithIdAndLaagnaam;
  readonly velden: Fields;
  selected?: boolean; // puur support voor de gui, dit aanpassen heeft geen invloed op het al of niet geselecteerd zijn voor openlayers
}

export type VeldenFormatter = Endomorphism<Fields>;

// De titel van een laag + geassocieerde state
// Een FieldsFormatSpec laat toe om veldwaarden om te zetten naar een andere representatie. Een transformatiefunctie obv
// een FieldsFormatSpec wordt heel vroeg bij het interpreteren van de laag VeldInfo aangemaakt omdat die voor alle rijen
// dezelfde is. Zoals altijd geldt dat een
export type FieldsFormatSpec = Record<string, Endomorphism<Field>>;

const isString = (value: ValueType): boolean => typeof value === "string";
export const isUrl = (value: string): boolean => value.startsWith("http");

export namespace Field {
  export const create = (maybeValue: Option<ValueType>, maybeLink: Option<string>): Field => {
    return {
      maybeValue: maybeValue,
      maybeLink: maybeLink.alt(
        maybeValue
          .filter(isString)
          .map(value => value as string)
          .filter(isUrl)
      )
    };
  };

  export const modify = (f: Endomorphism<ValueType>) => (field: Field): Field => Field.create(field.maybeValue.map(f), field.maybeLink);
}

export namespace Row {
  export const olFeatureLens: Lens<Row, ol.Feature> = Lens.fromPath<Row>()(["feature", "feature"]);
  export const idLens: Lens<Row, string> = Lens.fromPath<Row>()(["feature", "id"]);

  // We zouden dit ook helemaal naar de NoSqlFsSource kunnen schuiven (met een Either om geen info te verliezen).
  const matchingTypeValue: PartialFunction2<unknown, ke.VeldInfo, ValueType> = (value, veldinfo) => {
    switch (typeof value) {
      case "number": {
        return ke.VeldInfo.matchWithFallback({
          integer: () => option.some(value as ValueType),
          double: () => option.some(value),
          string: () => option.some(value.toString()),
          boolean: () => option.some(value !== 0),
          date: () => fromTimestamp(value),
          fallback: () => option.none
        })(veldinfo);
      }
      case "boolean": {
        return ke.VeldInfo.matchWithFallback({
          boolean: () => option.some(value as ValueType),
          integer: () => option.some(value ? 1 : 0),
          string: () => option.some(value ? "JA" : "NEEN"),
          fallback: () => option.none
        })(veldinfo);
      }
      case "string": {
        return ke.VeldInfo.matchWithFallback({
          integer: () => option.fromPredicate<ValueType>(Number.isInteger)(Number.parseInt(value, 10)),
          double: () => option.fromPredicate(not(Number.isNaN))(Number.parseFloat(value.replace(",", "."))),
          string: () => option.some(value),
          url: () => option.some(value),
          boolean: () => option.some(value !== ""),
          date: () => parseDate(option.fromNullable(veldinfo.parseFormat))(value), // we zouden kunnen afronden
          fallback: () => option.none
        })(veldinfo);
      }
      default:
        return option.none;
    }
  };

  const nestedPropertyValue = (properties: Properties, path: string[], veldinfo: ke.VeldInfo): Option<ValueType> =>
    array.fold(path, option.none, (head, tail) =>
      arrays.isEmpty(tail)
        ? option.fromNullable(properties[head]).chain(value => matchingTypeValue(value, veldinfo))
        : typeof properties[head] === "object"
        ? nestedPropertyValue(properties[head] as Properties, tail, veldinfo)
        : option.none
    );

  // haal alle mogelijke tokens die in de constante kunnen zitten
  // bvb "constante": "http://localhost/werf/schermen/werf/{werfid};werf=werf%2Fapi%2Fwerf%2F{werfid}" naar
  // "constante": "http://localhost/werf/schermen/werf/123123;werf=werf%2Fapi%2Fwerf%2F123123"
  const replaceTokens = (input: string, properties: Properties): string =>
    fromNullable(input.match(/{(.*?)}/g))
      .map(tokens =>
        tokens.reduce(
          (result, token) =>
            // token gevonden. eigenschap wordt 'werfId', vervang ze door de waarde van het veld
            result.replace(token, `${properties[token.slice(1, token.length - 1)]}`),
          input
        )
      )
      .getOrElse(input);

  const extractField: FunctionN<[Properties, ke.VeldInfo], Field> = (properties, veldinfo) => {
    // extraheer veldwaarde, rekening houdend met 'constante' veld in veldinfo indien aanwezig, krijgt properiteit over veldwaarde zelf
    // bij tonen in tabel
    const veldWaarde = fromNullable(veldinfo.constante).foldL<Option<ValueType>>(
      () => nestedPropertyValue(properties, veldinfo.naam.split("."), veldinfo),
      html => some(replaceTokens(html, properties))
    );

    // als er een html veld aanwezig is in veldinfo wordt dit gebruikt om te tonen in de tabel. De waarde zelf wordt als link meegegeven
    // indien dit een link is
    return fromNullable(veldinfo.html).foldL<Field>(
      () => Field.create(veldWaarde, none),
      html =>
        Field.create(
          some(replaceTokens(html, properties)),
          veldWaarde
            .filter(isString)
            .map(value => value as string)
            .filter(isUrl)
        )
    );
  };

  export const extractFieldValue = (properties: Properties, veldinfo: ke.VeldInfo): Option<ValueType> =>
    nestedPropertyValue(properties, veldinfo.naam.split("."), veldinfo);

  export const featureToFields: Curried2<ke.VeldInfo[], FeatureWithIdAndLaagnaam, Fields> = veldInfos => feature => {
    const propertiesWithId = Feature.properties(feature.feature);
    const velden = veldInfos.reduce((veld, vi) => {
      veld[vi.naam] = extractField(propertiesWithId, vi);
      return veld;
    }, {});
    return velden;
  };

  export const addField: FunctionN<[string, Field], Endomorphism<Fields>> = (label, field) => row => {
    const newRow = { ...row };
    newRow[label] = field;
    return newRow;
  };
}
