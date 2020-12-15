import { array, eq, option, ord } from "fp-ts";
import {
  Endomorphism,
  flow,
  identity,
  Predicate,
  Refinement,
} from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { Getter, Iso, Lens, Prism } from "monocle-ts";
import { iso, Newtype } from "newtype-ts";
import {
  NonNegativeInteger,
  prismNonNegativeInteger,
} from "newtype-ts/lib/NonNegativeInteger";
import * as rx from "rxjs";
import { catchError, map } from "rxjs/operators";

import { NosqlFsSource, PagingSpec } from "../../source";
import { Feature, toOlFeature } from "../../util/feature";
import { PartialFunction1 } from "../../util/function";
import { isOfKind } from "../../util/kinded";
import * as matchers from "../../util/matchers";
import * as ol from "../../util/openlayers-compat";
import * as setoids from "../../util/setoid";
import * as ke from "../kaart-elementen";

import { Row, ValueType } from "./row-model";

export type PageNumber = Newtype<
  { readonly PAGENUMBER: unique symbol },
  NonNegativeInteger
>;

export type SortDirection = "ASCENDING" | "DESCENDING";

export interface FieldSorting {
  readonly fieldKey: string;
  readonly direction: SortDirection;
  readonly veldinfo: ke.VeldInfo;
}

export interface Page {
  readonly pageNumber: PageNumber; // Het nummer dat gebruikt werd in de request die Page opleverde
  readonly rows: Row[];
}

export type DataRequest = RequestingData | DataReady | RequestFailed;

export interface RequestingData {
  readonly kind: "RequestingData";
}

export interface DataReady {
  readonly kind: "DataReady";
  readonly page: Page;
  // readonly featureCount: FeatureCountFetched;
  readonly pageSequence: number;
}

export interface RequestFailed {
  readonly kind: "RequestFailed";
}

export interface PageRequest {
  readonly pageNumber: PageNumber;
  readonly requestSequence: number;
  readonly dataExtent: ol.Extent;
  readonly fieldSortings: FieldSorting[];
  readonly rowCreator: PartialFunction1<ol.Feature, Row>;
}

export type PageFetcher = (arg: PageRequest) => rx.Observable<DataRequest>;

export type FeatureCount =
  | FeatureCountPending
  | FeatureCountFetched
  | FeatureCountFailed;

export interface FeatureCountPending {
  readonly kind: "FeatureCountPending";
}

export interface FeatureCountFetched {
  readonly kind: "FeatureCountFetched";
  readonly count: number;
}

export interface FeatureCountFailed {
  readonly kind: "FeatureCountFailed";
}

export interface FeatureCountRequest {
  readonly dataExtent: ol.Extent;
}

export type FeatureCountFetcher = (
  arg: FeatureCountRequest
) => rx.Observable<FeatureCount>;

export namespace SortDirection {
  export const setoidSortDirection: eq.Eq<SortDirection> = eq.eqString;

  export const invert: Endomorphism<SortDirection> = (direction) =>
    direction === "ASCENDING" ? "DESCENDING" : "ASCENDING";
}

export namespace Page {
  export const PageSize = 100;

  export const create: (pageNumber: PageNumber, rows: Row[]) => Page = (
    pageNumber,
    rows
  ) => ({
    pageNumber,
    rows,
  });

  const isoPageNumber: Iso<PageNumber, number> = iso<PageNumber>().compose(
    iso<NonNegativeInteger>()
  );
  const prismPageNumber: Prism<
    number,
    PageNumber
  > = prismNonNegativeInteger.composeIso(iso<PageNumber>().reverse());
  export const countToPages = (numFeatures: number): number =>
    Math.max(0, Math.floor((numFeatures - 1) / PageSize));
  export const getterPageNumber: Getter<PageNumber, number> = new Getter(
    prismPageNumber.reverseGet
  );
  export const asPageNumber: PartialFunction1<number, PageNumber> =
    prismPageNumber.getOption;
  export const asPageNumberFromNumberOfFeatures: (
    arg: number
  ) => PageNumber = flow(
    countToPages,
    asPageNumber,
    option.getOrElse(() => first)
  );
  export const pageNumberLens: Lens<Page, PageNumber> = Lens.fromProp<Page>()(
    "pageNumber"
  );
  export const rowsLens: Lens<Page, Row[]> = Lens.fromProp<Page>()("rows");
  export const ordPageNumber: ord.Ord<PageNumber> = ord.contramap(
    prismPageNumber.reverseGet
  )(ord.ordNumber);

  export const first: PageNumber = isoPageNumber.wrap(0);
  export const previous: Endomorphism<PageNumber> = isoPageNumber.modify((n) =>
    Math.max(0, n - 1)
  );
  export const next: Endomorphism<PageNumber> = isoPageNumber.modify(
    (n) => n + 1
  );
  export const set: (arg: number) => Endomorphism<PageNumber> = (value) => (
    pageNumber
  ) =>
    pipe(
      prismPageNumber.getOption(value),
      option.getOrElse(() => pageNumber)
    );

  export const isInPage: (arg: PageNumber) => Predicate<number> = (
    pageNumber
  ) => (i) => {
    const lowerPageBound = isoPageNumber.unwrap(pageNumber) * PageSize;
    return i >= lowerPageBound && i < lowerPageBound + PageSize;
  };

  export const last: (arg: number) => PageNumber = flow(countToPages, (n) =>
    pipe(
      prismPageNumber.getOption(n),
      option.getOrElse(() => first)
    )
  );
  export const isFirst: Predicate<PageNumber> = (pageNumber) =>
    ordPageNumber.equals(pageNumber, first);
  export const isTop: (arg: PageNumber) => Predicate<PageNumber> = (
    largestPageNumber
  ) => (pageNumber) => ordPageNumber.equals(pageNumber, largestPageNumber);
}

export namespace FieldSorting {
  export const directionLens: Lens<FieldSorting, SortDirection> = Lens.fromProp<
    FieldSorting
  >()("direction");
  export const fieldKeyLens: Lens<FieldSorting, string> = Lens.fromProp<
    FieldSorting
  >()("fieldKey");

  export const create: (
    SortDirection
  ) => (veldinfo: ke.VeldInfo) => FieldSorting = (direction) => (veldinfo) => ({
    fieldKey: veldinfo.naam,
    direction,
    veldinfo,
  });

  export const toPagingSpecDirection = (
    fieldSorting: FieldSorting
  ): PagingSpec.SortDirection =>
    fieldSorting.direction === "ASCENDING" ? "ASC" : "DESC";
}

export namespace DataRequest {
  export const RequestingData: RequestingData = {
    kind: "RequestingData",
  };

  export const DataReady = (
    pageNumber: PageNumber,
    pageSequence: number,
    rows: Row[]
  ): DataReady => ({
    kind: "DataReady",
    page: Page.create(pageNumber, rows),
    pageSequence,
  });

  export const RequestFailed: RequestFailed = {
    kind: "RequestFailed",
  };

  export const isDataReady: Refinement<DataRequest, DataReady> = isOfKind(
    "DataReady"
  );

  export const match: <A>(
    _: matchers.FullKindMatcher<DataRequest, A>
  ) => (arg: DataRequest) => A = matchers.matchKind;
}

export namespace PageFetcher {
  const selectedFeaturesInExtent: (
    extent: ol.Extent,
    selected: ol.Feature[]
  ) => ol.Feature[] = (extent, selected) =>
    array.filter(Feature.overlapsExtent(extent))(selected);
  const takePage: (arg: PageNumber) => Endomorphism<ol.Feature[]> = (
    pageNumber
  ) => array.filterWithIndex(Page.isInPage(pageNumber));
  const toRows: (
    arg1: PartialFunction1<ol.Feature, Row>
  ) => (arg2: ol.Feature[]) => Row[] = array.filterMap;
  const featureToFieldValue: (
    arg1: FieldSorting
  ) => (arg2: ol.Feature) => option.Option<ValueType> = (sorting) => (
    feature
  ) => Row.extractFieldValue(Feature.properties(feature), sorting.veldinfo);

  const directionOrd: <A>(
    direction: SortDirection
  ) => Endomorphism<ord.Ord<A>> = (direction) =>
    direction === "ASCENDING" ? identity : ord.getDualOrd;
  const ordFor: (arg: FieldSorting) => ord.Ord<ValueType> = (sorting) =>
    ke.VeldInfo.matchWithFallback<ord.Ord<ValueType>>({
      string: () => ord.ordString,
      integer: () => ord.ordNumber,
      double: () => ord.ordNumber,
      boolean: () => ord.getDualOrd(ord.ordBoolean), // Hack: omdat JA < NEEN, maar false < true
      // TODO + date -> parse + ordNumber
      fallback: () => ord.ordString,
    })(sorting.veldinfo);
  const sortingToOrd: (arg: FieldSorting) => ord.Ord<ol.Feature> = (sorting) =>
    pipe(
      ord.contramap(featureToFieldValue(sorting))(
        option.getOrd(ordFor(sorting))
      ),
      directionOrd(sorting.direction)
    );
  const sortingsToOrds: (
    arg: FieldSorting[]
  ) => ord.Ord<ol.Feature>[] = array.map(sortingToOrd);

  const sortFeatures: (
    arg: FieldSorting[]
  ) => Endomorphism<ol.Feature[]> = flow(sortingsToOrds, array.sortBy);

  const featuresToPage = (
    features: ol.Feature[],
    pageRequest: PageRequest
  ): Page => {
    const lastPage = Page.last(features.length);
    const pageNumber = ord.clamp(Page.ordPageNumber)(Page.first, lastPage)(
      pageRequest.pageNumber
    );
    return Page.create(
      pageNumber,
      pipe(
        features,
        sortFeatures(pageRequest.fieldSortings),
        takePage(pageRequest.pageNumber),
        toRows(pageRequest.rowCreator)
      )
    );
  };

  export const pageFromAllFeatures: (
    arg1: ol.Feature[]
  ) => (arg2: PageRequest) => Page = (features) => (pageRequest) =>
    featuresToPage(features, pageRequest);

  export const pageFromSelected: (
    selected: ol.Feature[]
  ) => (pageRequest: PageRequest) => Page = (selected) => (pageRequest) =>
    featuresToPage(
      selectedFeaturesInExtent(pageRequest.dataExtent, selected),
      pageRequest
    );

  // we gebruiken geen streaming API. Net zoals het oude Geoloket dat ook niet doet. Het gaat ook maar om 100 features maximaal.
  export const pageFromServer: (
    titel: string,
    source: NosqlFsSource,
    request: PageRequest
  ) => rx.Observable<DataRequest> = (titel, source, request) =>
    source
      .fetchFeatureCollection$({
        count: Page.PageSize,
        sortDirections: request.fieldSortings.map(
          FieldSorting.toPagingSpecDirection
        ),
        sortFields: pipe(
          request.fieldSortings,
          array.map(FieldSorting.fieldKeyLens.get),
          array.map(Feature.fieldKeyToPropertyPath)
        ),
        start: Page.getterPageNumber.get(request.pageNumber) * Page.PageSize,
      })
      .pipe(
        map((featureCollection) =>
          DataRequest.DataReady(
            request.pageNumber,
            request.requestSequence,
            pipe(
              featureCollection.features,
              array.map(toOlFeature(titel)),
              toRows(request.rowCreator)
            )
          )
        ),
        catchError(() => rx.of(DataRequest.RequestFailed))
      );
}

export namespace FeatureCount {
  const setoidFeatureCountFetched: eq.Eq<FeatureCountFetched> = pipe(
    eq.eqNumber,
    eq.contramap((fcp) => fcp.count)
  );
  const setoidFeatureCountPending: eq.Eq<FeatureCountPending> = eq.fromEquals(
    () => true
  );
  const setoidFeatureCountFailed: eq.Eq<FeatureCountFailed> = eq.fromEquals(
    () => true
  );

  export const setoidFeatureCount: eq.Eq<FeatureCount> = setoids.byKindEq<
    FeatureCount,
    string
  >({
    FeatureCountFetched: setoidFeatureCountFetched,
    FeatureCountPending: setoidFeatureCountPending,
    FeatureCountFailed: setoidFeatureCountFailed,
  });

  export const isPending: Refinement<FeatureCount, FeatureCountPending> = (
    featureCount
  ): featureCount is FeatureCountPending =>
    featureCount.kind === "FeatureCountPending";
  export const isFetched: Refinement<FeatureCount, FeatureCountFetched> = (
    featureCount
  ): featureCount is FeatureCountFetched =>
    featureCount.kind === "FeatureCountFetched";

  export const pending: FeatureCountPending = { kind: "FeatureCountPending" };
  export const failed: FeatureCountFailed = { kind: "FeatureCountFailed" };

  export const createFetched: (arg: number) => FeatureCountFetched = (
    count
  ) => ({
    kind: "FeatureCountFetched",
    count,
  });

  export const fetchedCount: PartialFunction1<FeatureCount, number> = flow(
    option.some,
    option.filter(isFetched),
    option.map((p) => p.count)
  );
}
