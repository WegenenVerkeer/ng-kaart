import { array, option, ord, setoid } from "fp-ts";
import { Curried2, Endomorphism, flow, Function1, Function2, Function3, identity, Predicate, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Ord } from "fp-ts/lib/Ord";
import { pipe } from "fp-ts/lib/pipeable";
import { Setoid } from "fp-ts/lib/Setoid";
import { Getter, Iso, Lens, Prism } from "monocle-ts";
import { iso, Newtype } from "newtype-ts";
import { NonNegativeInteger, prismNonNegativeInteger } from "newtype-ts/lib/NonNegativeInteger";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { catchError, map, startWith, take } from "rxjs/operators";

import * as FilterTotaal from "../../filter/filter-totaal";
import { NosqlFsSource, PagingSpec } from "../../source";
import { Feature, toOlFeature } from "../../util/feature";
import { PartialFunction1 } from "../../util/function";
import { isOfKind } from "../../util/kinded";
import * as matchers from "../../util/matchers";
import * as setoids from "../../util/setoid";
import * as ke from "../kaart-elementen";

import { Row, ValueType } from "./row-model";

export interface PageNumber extends Newtype<{ readonly PAGENUMBER: unique symbol }, NonNegativeInteger> {}

export type SortDirection = "ASCENDING" | "DESCENDING";

export interface FieldSorting {
  readonly fieldKey: string;
  readonly direction: SortDirection;
  readonly veldinfo: ke.VeldInfo;
}

export interface Page {
  readonly pageNumber: PageNumber; // Het nummer dat gebruikt werd in de request die Page opleverde
  readonly lastPageNumber: PageNumber; // Handig om dit hier op te slaan omdat we er vaak naar refereren
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

export type FeatureCount = FeatureCountPending | FeatureCountFetched | FeatureCountFailed;

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

export type FeatureCountFetcher = Function1<FeatureCountRequest, rx.Observable<FeatureCount>>;

export namespace SortDirection {
  export const setoidSortDirection: Setoid<SortDirection> = setoid.setoidString;

  export const invert: Endomorphism<SortDirection> = direction => (direction === "ASCENDING" ? "DESCENDING" : "ASCENDING");
}

export namespace Page {
  export const PageSize = 100;

  export const create: Function3<PageNumber, PageNumber, Row[], Page> = (pageNumber, lastPageNumber, rows) => ({
    pageNumber,
    lastPageNumber,
    rows
  });

  const isoPageNumber: Iso<PageNumber, number> = iso<PageNumber>().compose(iso<NonNegativeInteger>());
  const prismPageNumber: Prism<number, PageNumber> = prismNonNegativeInteger.composeIso(iso<PageNumber>().reverse());
  export const getterPageNumber: Getter<PageNumber, number> = new Getter(prismPageNumber.reverseGet);
  export const asPageNumber: PartialFunction1<number, PageNumber> = prismPageNumber.getOption;
  export const toPageNumberWithFallback: Function2<number, PageNumber, PageNumber> = (n, fallback) => asPageNumber(n).getOrElse(fallback);
  export const pageNumberLens: Lens<Page, PageNumber> = Lens.fromProp<Page>()("pageNumber");
  export const lastPageNumberLens: Lens<Page, PageNumber> = Lens.fromProp<Page>()("lastPageNumber");
  export const rowsLens: Lens<Page, Row[]> = Lens.fromProp<Page>()("rows");
  export const ordPageNumber: Ord<PageNumber> = ord.contramap(prismPageNumber.reverseGet, ord.ordNumber);

  export const first: PageNumber = isoPageNumber.wrap(0);
  export const previous: Endomorphism<PageNumber> = isoPageNumber.modify(n => Math.max(0, n - 1));
  export const next: Endomorphism<PageNumber> = isoPageNumber.modify(n => n + 1);
  export const set: Function1<number, Endomorphism<PageNumber>> = value => pageNumber =>
    prismPageNumber.getOption(value).getOrElse(pageNumber);

  export const isInPage: Function1<PageNumber, Predicate<number>> = pageNumber => i => {
    const lowerPageBound = isoPageNumber.unwrap(pageNumber) * PageSize;
    return i >= lowerPageBound && i < lowerPageBound + PageSize;
  };

  export const last: Function1<number, PageNumber> = numFeatures =>
    prismPageNumber.getOption(Math.floor(numFeatures / PageSize)).getOrElse(first);
  export const isFirst: Predicate<PageNumber> = pageNumber => ordPageNumber.equals(pageNumber, first);
  export const isTop: Function1<PageNumber, Predicate<PageNumber>> = largestPageNumber => pageNumber =>
    ordPageNumber.equals(pageNumber, largestPageNumber);
}

export namespace FieldSorting {
  export const directionLens: Lens<FieldSorting, SortDirection> = Lens.fromProp<FieldSorting>()("direction");
  export const fieldKeyLens: Lens<FieldSorting, string> = Lens.fromProp<FieldSorting>()("fieldKey");

  export const create: Curried2<SortDirection, ke.VeldInfo, FieldSorting> = direction => veldinfo => ({
    fieldKey: veldinfo.naam,
    direction,
    veldinfo
  });

  export const toPagingSpecDirection = (fieldSorting: FieldSorting): PagingSpec.SortDirection =>
    fieldSorting.direction === "ASCENDING" ? "ASC" : "DESC";
}

export namespace DataRequest {
  export const RequestingData: RequestingData = {
    kind: "RequestingData"
  };

  export const DataReady: Function3<PageNumber, PageNumber, Row[], DataReady> = (pageNumber, lastPageNumber, rows) => ({
    kind: "DataReady",
    page: Page.create(pageNumber, lastPageNumber, rows)
  });

  export const RequestFailed: RequestFailed = {
    kind: "RequestFailed"
  };

  export const isDataReady: Refinement<DataRequest, DataReady> = isOfKind("DataReady");

  export const match: <A>(_: matchers.FullKindMatcher<DataRequest, A>) => Function1<DataRequest, A> = matchers.matchKind;
}

export namespace PageFetcher {
  const featuresInExtent: Curried2<ol.Extent, ol.source.Vector, ol.Feature[]> = extent => source => source.getFeaturesInExtent(extent);
  const takePage: Function1<PageNumber, Endomorphism<ol.Feature[]>> = pageNumber => array.filterWithIndex(Page.isInPage(pageNumber));
  const toRows: Curried2<Function1<ol.Feature, Row>, ol.Feature[], Row[]> = array.map;
  const featureToFieldValue: Curried2<FieldSorting, ol.Feature, Option<ValueType>> = sorting => feature =>
    Row.extractField(Feature.properties(feature), sorting.veldinfo).maybeValue;

  const directionOrd: <A>(direction: SortDirection) => Endomorphism<Ord<A>> = direction =>
    direction === "ASCENDING" ? identity : ord.getDualOrd;
  const ordFor: Function1<FieldSorting, Ord<ValueType>> = sorting =>
    ke.VeldInfo.matchWithFallback<Ord<ValueType>>({
      string: () => ord.ordString,
      integer: () => ord.ordNumber,
      double: () => ord.ordNumber,
      boolean: () => ord.getDualOrd(ord.ordBoolean), // Hack: omdat JA < NEEN, maar false < true
      // TODO + date en datetime -> parse + ordNumber
      fallback: () => ord.ordString
    })(sorting.veldinfo);
  const sortingToOrd: Function1<FieldSorting, Ord<ol.Feature>> = sorting =>
    pipe(
      ord.contramap(featureToFieldValue(sorting), option.getOrd(ordFor(sorting))),
      directionOrd(sorting.direction)
    );
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
      Page.last(FeatureCountFetcher.countFromSource(source, pageRequest).count),
      flow(
        featuresInExtent(pageRequest.dataExtent),
        sortFeatures(pageRequest.fieldSortings),
        takePage(pageRequest.pageNumber),
        toRows(pageRequest.rowCreator)
      )(source)
    );

  // we gebruiken geen streaming API. Net zoals het oude Geoloket dat ook niet doet.
  export const pageFromServer: Function3<string, NosqlFsSource, PageRequest, rx.Observable<DataRequest>> = (titel, source, request) =>
    source
      .fetchFeatureCollection$({
        count: Page.PageSize,
        sortDirections: request.fieldSortings.map(FieldSorting.toPagingSpecDirection),
        sortFields: pipe(
          request.fieldSortings,
          array.map(FieldSorting.fieldKeyLens.get),
          array.map(Feature.fieldKeyToPropertyPath)
        ),
        start: Page.getterPageNumber.get(request.pageNumber)
      })
      .pipe(
        map(featureCollection =>
          DataRequest.DataReady(
            request.pageNumber,
            Page.asPageNumber(featureCollection.total).getOrElse(Page.first), // TODO dit is een hack
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
  const setoidFeatureCountFetched: Setoid<FeatureCountFetched> = setoid.contramap(fcp => fcp.count, setoid.setoidNumber);
  const setoidFeatureCountPending: Setoid<FeatureCountPending> = setoid.fromEquals(() => true);
  const setoidFeatureCountFailed: Setoid<FeatureCountFailed> = setoid.fromEquals(() => true);

  export const setoidFeatureCount: Setoid<FeatureCount> = setoids.byKindSetoid<FeatureCount, string>({
    FeatureCountFetched: setoidFeatureCountFetched,
    FeatureCountPending: setoidFeatureCountPending,
    FeatureCountFailed: setoidFeatureCountFailed
  });

  export const isPending: Refinement<FeatureCount, FeatureCountPending> = (featureCount): featureCount is FeatureCountPending =>
    featureCount.kind === "FeatureCountPending";
  export const isFetched: Refinement<FeatureCount, FeatureCountFetched> = (featureCount): featureCount is FeatureCountFetched =>
    featureCount.kind === "FeatureCountFetched";

  export const pending: FeatureCountPending = { kind: "FeatureCountPending" };
  export const failed: FeatureCountFailed = { kind: "FeatureCountFailed" };

  export const createFetched: Function1<number, FeatureCountFetched> = count => ({
    kind: "FeatureCountFetched",
    count
  });

  export const fetchedCount: PartialFunction1<FeatureCount, number> = flow(
    option.fromRefinement(isFetched),
    option.map(p => p.count)
  );
}

export namespace FeatureCountFetcher {
  export const sourceBasedFeatureCountFetcher: Function1<ol.source.Vector, FeatureCountFetcher> = source => featureCountRequest =>
    rx.timer(2000).pipe(
      take(1),
      map(() => countFromSource(source, featureCountRequest)),
      startWith(FeatureCount.pending)
    );

  export const countFromSource: Function2<ol.source.Vector, FeatureCountRequest, FeatureCountFetched> = (source, featureCountRequest) =>
    FeatureCount.createFetched(source.getFeaturesInExtent(featureCountRequest.dataExtent).length);

  const filterTotaalToFeatureCount: Function1<FilterTotaal.FilterTotaal, FeatureCount> = FilterTotaal.match({
    TotaalOpTeHalen: () => FeatureCount.pending as FeatureCount,
    TotaalOpgehaald: (ft: FilterTotaal.TotaalOpgehaald) => FeatureCount.createFetched(ft.totaal),
    TotaalOphalenMislukt: () => FeatureCount.failed,
    TeVeelData: () => FeatureCount.failed
  });

  // Haalt het totaal aantal features van server.
  // De onderliggende observable kan op elk moment emitten. In concreto wanneer een filter gezet wordt.
  // TODO. Gezien deze obs blijft leven, moeten we afsluiten er een nieuwe FeatureCountRequest binnen komt.
  export const serverBasedFeatureCountFetcher: Function1<NosqlFsSource, FeatureCountFetcher> = source => () =>
    source.fetchTotal$().pipe(map(filterTotaalToFeatureCount));
}
