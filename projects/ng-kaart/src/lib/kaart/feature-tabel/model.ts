import { array, option } from "fp-ts";
import { Curried2, Function1, Function2, Function3, Lazy } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { DateTime } from "luxon";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import { NosqlFsSource } from "../../source";
import * as arrays from "../../util/arrays";
import { parseDate, parseDateTime } from "../../util/date-time";
import { Feature } from "../../util/feature";
import { PartialFunction1, PartialFunction2 } from "../../util/function";
import { Pipeable } from "../../util/operators";
import * as ke from "../kaart-elementen";
import { ModelChanges } from "../model-changes";

export const tabulerbareLagen$: Function1<ModelChanges, rx.Observable<ke.ToegevoegdeVectorLaag[]>> = changes =>
  changes.lagenOpGroep["Voorgrond.Hoog"].pipe(map(lgn => lgn.filter(ke.isToegevoegdeVectorLaag)));

export const laagTitels$: Pipeable<ke.ToegevoegdeVectorLaag[], string[]> = lagen$ => lagen$.pipe(map(lgn => lgn.map(lg => lg.titel)));

export interface NoSqlFsLaagAndData {
  readonly titel: string;
  readonly veldInfos: ke.VeldInfo[]; // enkel de VeldInfos die we kunnen weergeven

  readonly source: NosqlFsSource;
  readonly data: Lazy<ol.Feature[]>;
  // later
  // readonly canRequestFullData: boolean;
  // readonly fetchAllData();  --> of nog beter in losse functie?
  // readonly ord: Ord<ol.Feature>;
  // readonly viewAsFilter: boolean;
  // readonly selectedVeldNamen: string[];
}

export interface TableModel {
  readonly laagData: NoSqlFsLaagAndData[];

  // andere globale eigenschappen
}

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
export interface Row {
  readonly [key: string]: Field;
}

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
export interface Field {
  readonly maybeValue: Option<ValueType>;
}

interface Properties {
  readonly [key: string]: ValueType | Properties;
}

export type ValueType = string | number | boolean | DateTime;

export const NoSqlFsLaagAndData: PartialFunction1<ke.ToegevoegdeVectorLaag, NoSqlFsLaagAndData> = laag =>
  ke.ToegevoegdeVectorLaag.noSqlFsSourceFold.headOption(laag).map(source => ({
    titel: laag.titel,
    veldInfos: ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag),
    source,
    data: () => source.getFeatures()
  }));

export const TableModel: Function1<ke.ToegevoegdeVectorLaag[], TableModel> = lagen => ({
  laagData: array.catOptions(lagen.map(NoSqlFsLaagAndData))
});

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

export const dataInBbox: Function2<NoSqlFsLaagAndData, ol.Extent, ol.Feature[]> = (laagAndData, bbox) =>
  laagAndData.data().filter(feature => ol.extent.intersects(feature.getGeometry().getExtent(), bbox));

const nestedPropertyValue: Function3<Properties, string[], ke.VeldInfo, Field> = (properties, path, veldinfo) =>
  array.fold(path, emptyField, (head, tail) =>
    arrays.isEmpty(tail)
      ? Field(option.fromNullable(properties[head]).chain(value => matchingTypeValue(value, veldinfo)))
      : typeof properties[head] === "object"
      ? nestedPropertyValue(properties[head] as Properties, tail, veldinfo)
      : emptyField
  );

const extractField: Curried2<Properties, ke.VeldInfo, Field> = properties => veldinfo =>
  nestedPropertyValue(properties, veldinfo.naam.split("."), veldinfo);

const featureToRow: Curried2<ke.VeldInfo[], ol.Feature, Row> = veldInfos => feature =>
  veldInfos.reduce((row, vi) => {
    row[vi.naam] = extractField({
      id: Feature.propertyId(feature).toUndefined(),
      ...Feature.properties(feature)
    })(vi);
    return row;
  }, {});

export const laagToRows: Function1<NoSqlFsLaagAndData, Row[]> = laagAndData => laagAndData.data().map(featureToRow(laagAndData.veldInfos));
