import { array, option, setoid } from "fp-ts";
import { Curried2, Endomorphism, flow, Function1, Function2, Function3, Predicate, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
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
  readonly fieldName: string;
  readonly direction: SortDirection;
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
  readonly rowPostProcessor: Endomorphism<Row>; // TODO dit met de rowCreator combineren
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

  // export const dataInBbox: Function2<NoSqlFsLaagAndData, ol.Extent, ol.Feature[]> = (laagAndData, bbox) =>
  //   laagAndData.data().filter(feature => ol.extent.intersects(feature.getGeometry().getExtent(), bbox));

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

  export const featureToRow: Curried2<ke.VeldInfo[], ol.Feature, Row> = veldInfos => feature =>
    veldInfos.reduce((row, vi) => {
      row[vi.naam] = extractField({
        id: Feature.propertyId(feature).toUndefined(),
        ...Feature.properties(feature)
      })(vi);
      return row;
    }, {});

  export const addField: Function2<string, Field, Endomorphism<Row>> = (label, field) => row => {
    const newRow = { ...row };
    newRow[label] = field;
    return newRow;
  };
}

export namespace Page {
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
  const PageSize = 100;

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
            array.take(
              PageSize,
              source.getFeaturesInExtent(pageRequest.dataExtent).map(
                flow(
                  pageRequest.rowCreator,
                  pageRequest.rowPostProcessor // transformer op dit niveau vermijdt overtollige creatie van lijst
                )
              )
            )
          )
        )
      )
    );
  };

  export const pageFromSource: Function2<ol.source.Vector, PageRequest, Page> = (source, pageRequest) =>
    Page.create(
      pageRequest.pageNumber,
      array.take(
        PageSize,
        source.getFeaturesInExtent(pageRequest.dataExtent).map(
          flow(
            pageRequest.rowCreator,
            pageRequest.rowPostProcessor // transformer op dit niveau vermijdt overtollige creatie van lijst
          )
        )
      )
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
