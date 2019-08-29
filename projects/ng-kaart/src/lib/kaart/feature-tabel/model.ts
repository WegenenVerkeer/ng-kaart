import { array, option, record, setoid, strmap } from "fp-ts";
import {
  constant,
  curried,
  Curried2,
  curry,
  Endomorphism,
  flip,
  Function1,
  Function2,
  Function3,
  identity,
  Lazy,
  pipe,
  Predicate
} from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Setoid, setoidNumber, setoidString } from "fp-ts/lib/Setoid";
import { DateTime } from "luxon";
import { Fold, Getter, Lens, Optional, Prism, Traversal } from "monocle-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { delay, map, switchMap, take } from "rxjs/operators";

import { FilterTotaal } from "../../filter";
import { NosqlFsSource } from "../../source";
import * as arrays from "../../util/arrays";
import { parseDate, parseDateTime } from "../../util/date-time";
import { Feature } from "../../util/feature";
import { applySequential, PartialFunction1, PartialFunction2 } from "../../util/function";
import { selectiveArrayTraversal } from "../../util/lenses";
import { Pipeable } from "../../util/operators";
import * as setoids from "../../util/setoid";
import * as ke from "../kaart-elementen";
import { ModelChanges } from "../model-changes";

// export const tabulerbareLagen$: Function1<ModelChanges, rx.Observable<ke.ToegevoegdeVectorLaag[]>> = changes =>
//   changes.lagenOpGroep["Voorgrond.Hoog"].pipe(map(lgn => lgn.filter(ke.isToegevoegdeVectorLaag)));

// export const laagTitels$: Pipeable<ke.ToegevoegdeVectorLaag[], string[]> = lagen$ => lagen$.pipe(map(lgn => lgn.map(lg => lg.titel)));

const PageSize = 100;

export interface Page {
  readonly rows: Row[];
  readonly pageNumber: number;
}

export type SyncUpdate = Endomorphism<TableModel>;
export type AsyncUpdate = Function1<TableModel, rx.Observable<Endomorphism<TableModel>>>;

export interface Update {
  readonly syncUpdate: SyncUpdate;
  readonly asyncUpdate: AsyncUpdate;
}

export interface TableModel {
  readonly laagData: NoSqlFsLaagAndData[];

  // andere globale eigenschappen
}

// Deze interface verzamelt de gegevens die we nodig hebben om 1 laag weer te geven in de tabelview. Het is
// tegelijkertijd een abstractie van het onderliggende model + state nodig voor de tabel use cases (MVP).
export interface NoSqlFsLaagAndData {
  readonly titel: string;
  readonly veldinfos: ke.VeldInfo[]; // enkel de VeldInfos die we kunnen weergeven
  readonly totaal: FilterTotaal;
  readonly featureCount: FeatureCount; // aantal features in de tabel over alle pagina's heen

  readonly headers: ColumnHeaders;

  readonly source: NosqlFsSource;
  readonly page: Option<Page>; // We houden maar 1 pagina van data tegelijkertijd in het geheugen. (later meer)
  readonly nextPageUpdate: number; // Het sequentienummer dat verwacht is, niet het paginanummer
  readonly updatePending: boolean;
  // later
  // readonly canRequestFullData: boolean;
  // readonly fetchAllData();  --> of nog beter in losse functie?
  // readonly ord: Ord<ol.Feature>;
  // readonly viewAsFilter: boolean;
  // readonly selectedVeldNamen: string[];
}

// headers.map(_ => "minmax(150px, 1fr)").join(" ")
export interface ColumnHeaders {
  readonly headers: ColumnHeader[];
  readonly columnWidths: string; // we willen dit niet in de template opbouwen
}

export interface ColumnHeader {
  readonly key: string; // om op te zoeken in een row
  readonly label: string; // voor weergave
}

export interface TableHeader {
  readonly titel: string;
  readonly count: number | undefined;
}

export type FeatureCount = FeatureCountPending | FeatureCountFetched;

export interface FeatureCountPending {
  readonly kind: "FeatureCountPending";
}

export interface FeatureCountFetched {
  readonly kind: "FeatureCountFetched";
  readonly count: number;
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

const NoSqlFsLaagAndData: PartialFunction1<ke.ToegevoegdeVectorLaag, NoSqlFsLaagAndData> = laag =>
  ke.ToegevoegdeVectorLaag.noSqlFsSourceFold.headOption(laag).map(source => {
    const veldinfos = ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag);
    return {
      titel: laag.titel,
      veldinfos,
      totaal: laag.filterinstellingen.totaal,
      featureCount: FeatureCount.pending,
      headers: ColumnHeaders(
        veldinfos.map(vi => ({
          key: vi.naam,
          label: option.fromNullable(vi.label).getOrElse(vi.naam),
          aantalFeatures: 123
        }))
      ),
      source,
      page: option.none,
      nextPageUpdate: 0,
      updatePending: true
    };
  });

const ColumnHeaders: Function1<ColumnHeader[], ColumnHeaders> = headers => ({
  headers,
  columnWidths: headers.map(_ => "minmax(150px, 1fr)").join(" ")
});

const Page: Function2<Row[], number, Page> = (rows, pageNumber) => ({
  rows,
  pageNumber
});

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

export namespace TableHeader {
  export const toHeader: Function1<NoSqlFsLaagAndData, TableHeader> = laag => ({
    titel: laag.titel,
    count: laag.featureCount.kind === "FeatureCountPending" ? undefined : laag.featureCount.count
  });

  export const setoidTableHeader: Setoid<TableHeader> = setoid.getStructSetoid({
    titel: setoidString,
    count: setoidNumber // TODO controleer undefined
  });
}

export namespace TableModel {
  export const empty: Lazy<TableModel> = () => ({
    laagData: []
  });

  export const create: Function1<ke.ToegevoegdeVectorLaag[], TableModel> = lagen => ({
    laagData: array.catOptions(lagen.map(NoSqlFsLaagAndData))
  });

  export const Update: Function2<SyncUpdate, AsyncUpdate, Update> = (syncUpdate, asyncUpdate) => ({
    syncUpdate,
    asyncUpdate
  });

  export const syncUpdateOnly: Function1<SyncUpdate, Update> = flip(curry(Update))(constant(rx.EMPTY));

  const laagDataLens: Lens<TableModel, NoSqlFsLaagAndData[]> = Lens.fromProp<TableModel, "laagData">("laagData");

  const pageOptional: Optional<NoSqlFsLaagAndData, Page> = Optional.fromOptionProp<NoSqlFsLaagAndData>()("page");
  const headersLens: Lens<NoSqlFsLaagAndData, ColumnHeaders> = Lens.fromProp<NoSqlFsLaagAndData, "headers">("headers");
  const pageLens: Lens<NoSqlFsLaagAndData, Option<Page>> = Lens.fromProp<NoSqlFsLaagAndData>()("page");
  const nextPageUpdateLens: Lens<NoSqlFsLaagAndData, number> = Lens.fromProp<NoSqlFsLaagAndData>()("nextPageUpdate");
  const updatePendingLens: Lens<NoSqlFsLaagAndData, boolean> = Lens.fromProp<NoSqlFsLaagAndData>()("updatePending");
  const aantalFeaturesLens: Lens<NoSqlFsLaagAndData, FeatureCount> = Lens.fromProp<NoSqlFsLaagAndData>()("featureCount");

  const isFeatureCountPending: Predicate<NoSqlFsLaagAndData> = pipe(
    aantalFeaturesLens.get,
    FeatureCount.isPending
  );

  const isExpectedPage: Function1<number, Prism<NoSqlFsLaagAndData, NoSqlFsLaagAndData>> = sequenceNumber =>
    Prism.fromPredicate(laag => laag.nextPageUpdate === sequenceNumber);

  const laagForTitelTraversal: Function1<string, Traversal<TableModel, NoSqlFsLaagAndData>> = titel => {
    return laagDataLens.composeTraversal(selectiveArrayTraversal(tl => tl.titel === titel));
  };

  export const laagForTitelOnLaagData: Curried2<string, NoSqlFsLaagAndData[], Option<NoSqlFsLaagAndData>> = titel => laagData =>
    array.findFirst(laagData, laag => laag.titel === titel);

  export const laagForTitel: Curried2<string, TableModel, Option<NoSqlFsLaagAndData>> = titel => model => {
    // asFold geeft een bug: Zie https://github.com/gcanti/monocle-ts/issues/96
    // return laagForTitelTraversal(titel).asFold().headOption;
    return laagForTitelOnLaagData(titel)(model.laagData);
  };

  export const headersForTitel: Curried2<string, TableModel, Option<ColumnHeaders>> = titel => {
    // return laagForTitelTraversal(titel)
    //   .composeLens(headersLens)
    //   .asFold().headOption;
    return model => array.findFirst(laagDataLens.get(model), laag => laag.titel === titel).map(headersLens.get);
  };

  const currentPageForTitelTraversal: Function1<string, Traversal<TableModel, Page>> = titel =>
    laagForTitelTraversal(titel).composeOptional(pageOptional);

  export const currentPageForTitel: Curried2<string, TableModel, Option<Page>> = titel => {
    // return currentPageForTitelTraversal(titel).asFold().headOption;
    return model => laagForTitel(titel)(model).chain(pageLens.get);
  };

  // Uiteraard moet er ook nog gesorteerd en tot de extent beperkt worden.
  const noSqlFsPage: Function2<NoSqlFsLaagAndData, number, Page> = (laag, pageNumber) => {
    console.log("****Fetching ", pageNumber, " for ", laag.titel);
    return Page(array.take(PageSize, laag.source.getFeatures().map(featureToRow(laag.veldinfos))), pageNumber);
  };

  const noSqlFsCount: Function1<NoSqlFsLaagAndData, FeatureCount> = laag => FeatureCount.createFetched(laag.source.getFeatures().length);

  // Zet de binnenkomende pagina indien diens sequenceNumber dat is dat we verwachten
  const pageUpdate: Function3<Page, string, number, SyncUpdate> = (page, laagTitel, sequenceNumber) =>
    laagForTitelTraversal(laagTitel)
      .composePrism(isExpectedPage(sequenceNumber))
      .modify(applySequential([pageLens.set(option.some(page)), updatePendingLens.set(false)]));

  const featureCountUpdate: Function2<NoSqlFsLaagAndData, FeatureCount, SyncUpdate> = (laag, count) =>
    laagForTitelTraversal(laag.titel).modify(aantalFeaturesLens.set(count));

  const fetchTableTotals: AsyncUpdate = model =>
    rx.timer(2000).pipe(
      take(1),
      switchMap(() => rx.from(model.laagData.filter(isFeatureCountPending).map(laag => featureCountUpdate(laag, noSqlFsCount(laag)))))
    );

  // We willen hier niet de state voor alle lagen opnieuw initialiseren. We moeten enkel de nieuwe lagen toevoegen en de
  // oude verwijderen.
  export const pasLagenAan: Function1<ke.ToegevoegdeVectorLaag[], Update> = lagen => {
    return Update(
      laagDataLens.modify(laagData =>
        array.catOptions(
          // Deze constructie met eerst iteren over lagen is gekozen om de volgorde zoals in de lagenkiezer te behouden
          lagen.map(laag => laagForTitelOnLaagData(laag.titel)(laagData).orElse(() => NoSqlFsLaagAndData(laag)))
        )
      ),
      model =>
        rx.merge(
          // De eerste page ophalen van alle nieuwe lagen ophalen
          rx.timer(2000).pipe(
            take(1), // bij de start zijn de features nog niet geladen. beter uiteraard wachten op event van source
            switchMap(() =>
              rx.from(
                model.laagData
                  .filter(laag => laag.updatePending) // risico om zelfde data 2x op te vragen indien vorige toevoeging nog niet verwerkt
                  .map(laag => pageUpdate(noSqlFsPage(laag, 0), laag.titel, laag.nextPageUpdate))
              )
            )
          ),
          fetchTableTotals(model)
        )
    );
  };
}

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

const featureToRow: Curried2<ke.VeldInfo[], ol.Feature, Row> = veldInfos => feature =>
  veldInfos.reduce((row, vi) => {
    row[vi.naam] = extractField({
      id: Feature.propertyId(feature).toUndefined(),
      ...Feature.properties(feature)
    })(vi);
    return row;
  }, {});

// export const laagToRows: Function1<NoSqlFsLaagAndData, Row[]> = laagAndData => laagAndData.page.map(featureToRow(laagAndData.veldinfos));
