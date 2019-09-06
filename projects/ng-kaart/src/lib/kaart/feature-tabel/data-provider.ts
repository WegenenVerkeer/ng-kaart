import { array, option, ord, setoid } from "fp-ts";
import {
  curried,
  Curried2,
  curry,
  Endomorphism,
  flow,
  Function1,
  Function2,
  Function3,
  identity,
  Predicate,
  Refinement
} from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { between, Ord } from "fp-ts/lib/Ord";
import { Setoid } from "fp-ts/lib/Setoid";
import { DateTime } from "luxon";
import { Iso, Lens, Prism } from "monocle-ts";
import { iso, Newtype, prism } from "newtype-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { debounceTime, map, share, startWith, take, takeUntil } from "rxjs/operators";

import * as arrays from "../../util/arrays";
import { parseDate, parseDateTime } from "../../util/date-time";
import { Feature } from "../../util/feature";
import { PartialFunction2 } from "../../util/function";
import { isOfKind } from "../../util/kinded";
import * as matchers from "../../util/matchers";
import * as setoids from "../../util/setoid";
import * as ke from "../kaart-elementen";

export type ValueType = string | number | boolean | DateTime;

export interface Field {
  readonly maybeValue: Option<ValueType>;
}

// Zou kunen new-type zijn. Afwachten of er nog properties nuttig zijn
export interface Row {
  readonly [key: string]: Field;
}

export interface PageNumber extends Newtype<{ readonly PAGENUMBER: unique symbol }, number> {}

export type SortDirection = "ASCENDING" | "DESCENDING";

export interface FieldSorting {
  readonly fieldKey: string;
  readonly direction: SortDirection;
  readonly veldinfo: ke.VeldInfo;
}

export interface Page {
  readonly pageNumber: PageNumber;
  readonly rows: Row[];
}

export type DataRequest = RequestingData | DataReady | RequestFailed;

export interface RequestingData {
  readonly kind: "RequestingData";
}

export interface DataReady {
  readonly kind: "DataReady";
  readonly page: Page;
}

export interface RequestFailed {
  readonly kind: "RequestFailed";
}

export interface PageRequest {
  readonly pageNumber: PageNumber;
  readonly requestSequence: number;
  readonly dataExtent: ol.Extent;
  readonly fieldSortings: FieldSorting[];
  readonly rowCreator: Function1<ol.Feature, Row>;
}

export type PageFetcher = Function1<PageRequest, rx.Observable<DataRequest>>;

export type FeatureCount = FeatureCountPending | FeatureCountFetched;

export interface FeatureCountPending {
  readonly kind: "FeatureCountPending";
}

export interface FeatureCountFetched {
  readonly kind: "FeatureCountFetched";
  readonly count: number;
}

export interface FeatureCountRequest {
  readonly dataExtent: ol.Extent;
}

export type FeatureCountFetcher = Function1<FeatureCountRequest, rx.Observable<FeatureCount>>;

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
    return veldInfos.reduce((row, vi) => {
      row[vi.naam] = extractField(propertiesWithId, vi);
      return row;
    }, {});
  };

  export const addField: Function2<string, Field, Endomorphism<Row>> = (label, field) => row => {
    const newRow = { ...row };
    newRow[label] = field;
    return newRow;
  };
}

export namespace Page {
  export const PageSize = 100;

  export const create: Function2<PageNumber, Row[], Page> = (pageNumber, rows) => ({
    pageNumber,
    rows
  });

  const isoPageNumber: Iso<PageNumber, number> = iso<PageNumber>();
  const prismPageNumer: Prism<number, PageNumber> = prism<PageNumber>(n => n >= 0);
  export const pageNumberLens: Lens<Page, PageNumber> = Lens.fromProp<Page>()("pageNumber");
  export const rowsLens: Lens<Page, Row[]> = Lens.fromProp<Page>()("rows");

  export const first: PageNumber = isoPageNumber.wrap(0);
  export const previous: Endomorphism<PageNumber> = isoPageNumber.modify(n => Math.max(0, n - 1));
  export const next: Endomorphism<PageNumber> = isoPageNumber.modify(n => n + 1);

  export const isInPage: Function1<PageNumber, Predicate<number>> = pageNumber => i => {
    const lowerPageBound = isoPageNumber.unwrap(pageNumber) * PageSize;
    return i >= lowerPageBound && i < lowerPageBound + PageSize;
  };
}

export namespace DataRequest {
  export const RequestingData: RequestingData = {
    kind: "RequestingData"
  };

  export const DataReady: Function2<PageNumber, Row[], DataReady> = (pageNumber, rows) => ({
    kind: "DataReady",
    page: Page.create(pageNumber, rows)
  });

  export const RequestFailed: RequestFailed = {
    kind: "RequestFailed"
  };

  export const isDataReady: Refinement<DataRequest, DataReady> = isOfKind("DataReady");
}

export namespace PageFetcher {
  export const sourceBasedPageFetcher: Function1<ol.source.Vector, PageFetcher> = source => pageRequest => {
    // We willen zo vlug als mogelijk de data bijwerken. Het is evenwel mogelijk dat het een tijd duurt vooraleer de
    // data binnen komt en we willen ook niet blijven wachten. Daarnaast willen we de observable niet voor altijd open
    // houden.
    return rx.merge(
      rx.of(DataRequest.RequestingData),
      rx.timer(2000).pipe(
        take(1), // bij de start zijn de features nog niet geladen. beter uiteraard wachten op event van source
        map(() =>
          DataRequest.DataReady(
            pageRequest.pageNumber,
            array.take(Page.PageSize, source.getFeaturesInExtent(pageRequest.dataExtent).map(pageRequest.rowCreator))
          )
        )
      )
    );
  };

  const featuresInExtend: Curried2<ol.Extent, ol.source.Vector, ol.Feature[]> = extent => source => source.getFeaturesInExtent(extent);
  const takePage: Function1<PageNumber, Endomorphism<ol.Feature[]>> = pageNumber => array.filterWithIndex(Page.isInPage(pageNumber));
  const toRows: Curried2<Function1<ol.Feature, Row>, ol.Feature[], Row[]> = array.map;
  const featureToFieldValue: Curried2<FieldSorting, ol.Feature, Option<ValueType>> = sorting => feature =>
    Row.extractField(Feature.properties(feature), sorting.veldinfo).maybeValue;
  const ordFor: Function1<FieldSorting, Ord<ValueType>> = sorting =>
    ke.VeldInfo.matchWithFallback<Ord<ValueType>>({
      string: () => ord.ordString,
      integer: () => ord.ordNumber,
      double: () => ord.ordNumber,
      boolean: () => ord.ordBoolean,
      // TODO + date en datetime -> parse + ordNumber
      fallback: () => ord.ordString
    })(sorting.veldinfo);
  const sortingToOrd: Function1<FieldSorting, Ord<ol.Feature>> = sorting =>
    ord.contramap(featureToFieldValue(sorting), option.getOrd(ordFor(sorting)));
  const sortingsToOrds: Function1<FieldSorting[], Ord<ol.Feature>[]> = array.map(sortingToOrd);
  const unlessNoSortableFields: Function1<Option<Endomorphism<ol.Feature[]>>, Endomorphism<ol.Feature[]>> = o => o.getOrElse(identity);
  const sortFeatures: Function1<FieldSorting[], Endomorphism<ol.Feature[]>> = flow(
    sortingsToOrds,
    array.sortBy,
    unlessNoSortableFields
  );

  export const pageFromSource: Function2<ol.source.Vector, PageRequest, Page> = (source, pageRequest) =>
    Page.create(
      pageRequest.pageNumber,
      flow(
        featuresInExtend(pageRequest.dataExtent),
        sortFeatures(pageRequest.fieldSortings),
        takePage(pageRequest.pageNumber),
        toRows(pageRequest.rowCreator)
      )(source)
    );
}

export namespace FeatureCount {
  const setoidFeatureCountFetched: Setoid<FeatureCountFetched> = setoid.contramap(fcp => fcp.count, setoid.setoidNumber);
  const setoidFeatureCountPending: Setoid<FeatureCountPending> = setoid.fromEquals(() => true);

  export const setoidFeatureCount: Setoid<FeatureCount> = setoids.byKindSetoid<FeatureCount, string>({
    FeatureCountFetched: setoidFeatureCountFetched,
    FeatureCountPending: setoidFeatureCountPending
  });

  export const isPending: Predicate<FeatureCount> = featureCount => featureCount.kind === "FeatureCountPending";

  export const pending: FeatureCountPending = { kind: "FeatureCountPending" };

  export const createFetched: Function1<number, FeatureCountFetched> = count => ({
    kind: "FeatureCountFetched",
    count
  });
}

export namespace FeatureCountFetcher {
  export const sourceBasedFeatureCountFetcher: Function1<ol.source.Vector, FeatureCountFetcher> = source => featureCountRequest =>
    rx.timer(2000).pipe(
      take(1),
      map(() => countFromSource(source, featureCountRequest)),
      startWith(FeatureCount.pending)
    );

  export const countFromSource: Function2<ol.source.Vector, FeatureCountRequest, FeatureCount> = (source, featureCountRequest) =>
    FeatureCount.createFetched(source.getFeaturesInExtent(featureCountRequest.dataExtent).length);
}
