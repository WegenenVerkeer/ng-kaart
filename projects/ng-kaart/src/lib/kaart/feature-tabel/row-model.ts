import { array, option } from "fp-ts";
import { Curried2, Endomorphism, FunctionN } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { DateTime } from "luxon";
import { Lens } from "monocle-ts";
import * as ol from "openlayers";

import * as arrays from "../../util/arrays";
import { parseDate, parseDateTime } from "../../util/date-time";
import { Feature, FeatureWithIdAndLaagnaam } from "../../util/feature";
import { PartialFunction2 } from "../../util/function";
import * as ke from "../kaart-elementen";

export type ValueType = string | number | boolean | DateTime;

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
export interface Field {
  readonly maybeValue: Option<ValueType>;
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

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
interface Properties {
  readonly [key: string]: ValueType | Properties;
}

export namespace Row {
  export const Field = (maybeValue: Option<ValueType>): Field => ({ maybeValue });

  export const olFeatureLens: Lens<Row, ol.Feature> = Lens.fromPath<Row>()(["feature", "feature"]);
  export const idLens: Lens<Row, string> = Lens.fromPath<Row>()(["feature", "id"]);

  const emptyField: Field = Field(option.none);

  // We zouden dit ook helemaal naar de NoSqlFsSource kunnen schuiven (met een Either om geen info te verliezen).
  const matchingTypeValue: PartialFunction2<any, ke.VeldInfo, ValueType> = (value, veldinfo) =>
    option
      .fromPredicate<ValueType>(v => typeof v === "number" && (veldinfo.type === "double" || veldinfo.type === "integer"))(value)
      .orElse(() => option.fromPredicate<boolean>(v => typeof v === "boolean" && veldinfo.type === "boolean")(value))
      .orElse(() =>
        option
          .fromPredicate<string>(v => typeof v === "string" && veldinfo.type === "datetime")(value)
          .chain(v => parseDateTime(option.fromNullable(veldinfo.parseFormat))(v))
      )
      .orElse(() =>
        option
          .fromPredicate<string>(v => typeof v === "string" && veldinfo.type === "date")(value)
          .chain(v => parseDate(option.fromNullable(veldinfo.parseFormat))(v))
      )
      .orElse(() => option.fromPredicate<string>(v => typeof v === "string" && veldinfo.type === "string")(value));

  const nestedPropertyValue = (properties: Properties, path: string[], veldinfo: ke.VeldInfo): Option<ValueType> =>
    array.fold(path, option.none, (head, tail) =>
      arrays.isEmpty(tail)
        ? option.fromNullable(properties[head]).chain(value => matchingTypeValue(value, veldinfo))
        : typeof properties[head] === "object"
        ? nestedPropertyValue(properties[head] as Properties, tail, veldinfo)
        : option.none
    );

  const extractField: FunctionN<[Properties, ke.VeldInfo], Field> = (properties, veldinfo) =>
    Field(nestedPropertyValue(properties, veldinfo.naam.split("."), veldinfo));

  export const extractFieldValue = (properties: Properties, veldinfo: ke.VeldInfo): Option<ValueType> =>
    nestedPropertyValue(properties, veldinfo.naam.split("."), veldinfo);

  export const featureToFields: Curried2<ke.VeldInfo[], FeatureWithIdAndLaagnaam, Fields> = veldInfos => feature => {
    const propertiesWithId = Feature.propertiesWithId(feature);
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
