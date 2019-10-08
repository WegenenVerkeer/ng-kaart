import { array, option, ord, setoid } from "fp-ts";
import { Curried2, Endomorphism, flow, Function1, Function2, Function3, identity, Predicate, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Ord } from "fp-ts/lib/Ord";
import { pipe } from "fp-ts/lib/pipeable";
import { Setoid } from "fp-ts/lib/Setoid";
import { DateTime } from "luxon";
import { Getter, Iso, Lens, Prism } from "monocle-ts";
import { iso, Newtype } from "newtype-ts";
import { NonNegativeInteger, prismNonNegativeInteger } from "newtype-ts/lib/NonNegativeInteger";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map, startWith, take } from "rxjs/operators";

import * as FilterTotaal from "../../filter/filter-totaal";
import { NosqlFsSource } from "../../source";
import * as arrays from "../../util/arrays";
import { parseDate, parseDateTime } from "../../util/date-time";
import { Feature } from "../../util/feature";
import { PartialFunction1, PartialFunction2 } from "../../util/function";
import { isOfKind } from "../../util/kinded";
import * as matchers from "../../util/matchers";
import * as setoids from "../../util/setoid";
import * as ke from "../kaart-elementen";

export type ValueType = string | number | boolean | DateTime;

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
export interface Field {
  readonly maybeValue: Option<ValueType>;
}

export type Velden = Record<string, Field>;

export interface Row {
  readonly feature: ol.Feature;
  readonly velden: Velden;
  selected?: boolean; // support voor de gui
}

export type RowFormatter = Endomorphism<Velden>;

// De titel van een laag + geassocieerde state
// Een RowFormatSpec laat toe om veldwaarden om te zetten naar een andere representatie. Een transformatiefunctie obv
// een RowFormatSpec wordt heel vroeg bij het interpreteren van de laag VeldInfo aangemaakt omdat die voor alle rijen
// dezelfde is. Zoals altijd geldt dat een
export type RowFormatSpec = Record<string, Endomorphism<Field>>;

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
interface Properties {
  readonly [key: string]: ValueType | Properties;
}

export namespace Row {
  const Field: Function1<Option<ValueType>, Field> = maybeValue => ({ maybeValue });

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

  const nestedPropertyValue: Function3<Properties, string[], ke.VeldInfo, Field> = (properties, path, veldinfo) =>
    array.fold(path, emptyField, (head, tail) =>
      arrays.isEmpty(tail)
        ? Field(option.fromNullable(properties[head]).chain(value => matchingTypeValue(value, veldinfo)))
        : typeof properties[head] === "object"
        ? nestedPropertyValue(properties[head] as Properties, tail, veldinfo)
        : emptyField
    );

  export const extractField: Function2<Properties, ke.VeldInfo, Field> = (properties, veldinfo) =>
    nestedPropertyValue(properties, veldinfo.naam.split("."), veldinfo);

  export const featureToRow: Curried2<ke.VeldInfo[], ol.Feature, Row> = veldInfos => feature => {
    const propertiesWithId = Feature.propertiesWithId(feature);
    const velden = veldInfos.reduce((veld, vi) => {
      veld[vi.naam] = extractField(propertiesWithId, vi);
      return veld;
    }, {});
    return {
      feature: feature,
      velden: velden
    };
  };

  export const featureToVelden: Curried2<ke.VeldInfo[], ol.Feature, Velden> = veldInfos => feature => {
    const propertiesWithId = Feature.propertiesWithId(feature);
    const velden = veldInfos.reduce((veld, vi) => {
      veld[vi.naam] = extractField(propertiesWithId, vi);
      return veld;
    }, {});
    return velden;
  };

  export const addField: Function2<string, Field, Endomorphism<Velden>> = (label, field) => row => {
    const newRow = { ...row };
    newRow[label] = field;
    return newRow;
  };
}
