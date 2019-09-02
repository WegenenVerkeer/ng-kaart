import { array, option, record, setoid, strmap, traversable } from "fp-ts";
import {
  constant,
  curried,
  Curried2,
  curry,
  Endomorphism,
  flip,
  flow,
  Function1,
  Function2,
  Function3,
  identity,
  Lazy,
  pipe,
  Predicate
} from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { some } from "fp-ts/lib/Record";
import { Setoid, setoidNumber, setoidString } from "fp-ts/lib/Setoid";
import { DateTime } from "luxon";
import { Fold, fromTraversable, Getter, Lens, Optional, Prism, Traversal } from "monocle-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { delay, map, switchMap, take } from "rxjs/operators";
import { isNumber } from "util";

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
import { Viewinstellingen } from "../kaart-protocol-subscriptions";
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
  readonly laagData: LaagModel[];

  // andere globale eigenschappen
  readonly viewinstellingen: Viewinstellingen;
}

// Deze interface verzamelt de gegevens die we nodig hebben om 1 laag weer te geven in de tabelview. Het is
// tegelijkertijd een abstractie van het onderliggende model + state nodig voor de tabel use cases (MVP).
export interface LaagModel {
  readonly titel: string;
  readonly veldinfos: ke.VeldInfo[]; // enkel de VeldInfos die we kunnen weergeven
  readonly totaal: FilterTotaal;
  readonly featureCount: FeatureCount; // aantal features in de tabel over alle pagina's heen

  readonly headers: ColumnHeaders;
  readonly selectedVeldnamen: string[]; // enkel een subset van de velden is zichtbaar
  readonly rowTransformer: Endomorphism<Row>; // bewerkt de ruwe rij (bijv. locatieveld toevoegen)

  readonly source: NosqlFsSource;
  readonly page: Option<Page>; // We houden maar 1 pagina van data tegelijkertijd in het geheugen. (later meer)
  readonly nextPageUpdate: number; // Het sequentienummer dat verwacht is, niet het paginanummer
  readonly updatePending: boolean;

  readonly viewinstellingen: Viewinstellingen; // Kopie van gegevens in TableModel. Handig om hier te refereren

  // later
  // readonly canRequestFullData: boolean;
  // readonly fetchAllData();  --> of nog beter in losse functie?
  // readonly ord: Ord<ol.Feature>;
  // readonly viewAsFilter: boolean;
}

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

const Page: Function2<Row[], number, Page> = (rows, pageNumber) => ({
  rows,
  pageNumber
});

namespace ColumnHeaders {
  export const create: Function1<ColumnHeader[], ColumnHeaders> = headers => ({
    headers,
    columnWidths: headers.map(_ => "minmax(150px, 1fr)").join(" ")
  });
}

namespace Row {
  export const addField: Function2<string, Field, Endomorphism<Row>> = (label, field) => row => {
    const newRow = { ...row };
    newRow[label] = field;
    return newRow;
  };
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

export namespace TableHeader {
  export const toHeader: Function1<LaagModel, TableHeader> = laag => ({
    titel: laag.titel,
    count: laag.featureCount.kind === "FeatureCountPending" ? undefined : laag.featureCount.count
  });

  export const setoidTableHeader: Setoid<TableHeader> = setoid.getStructSetoid({
    titel: setoidString,
    count: setoidNumber // TODO controleer undefined
  });
}

export namespace LaagModel {
  export const titelLens: Lens<LaagModel, string> = Lens.fromProp<LaagModel>()("titel");
  export const pageOptional: Optional<LaagModel, Page> = Optional.fromOptionProp<LaagModel>()("page");
  export const headersLens: Lens<LaagModel, ColumnHeaders> = Lens.fromProp<LaagModel, "headers">("headers");
  export const pageLens: Lens<LaagModel, Option<Page>> = Lens.fromProp<LaagModel>()("page");
  export const nextPageUpdateLens: Lens<LaagModel, number> = Lens.fromProp<LaagModel>()("nextPageUpdate");
  export const updatePendingLens: Lens<LaagModel, boolean> = Lens.fromProp<LaagModel>()("updatePending");
  export const aantalFeaturesLens: Lens<LaagModel, FeatureCount> = Lens.fromProp<LaagModel>()("featureCount");
  export const viewinstellingLens: Lens<LaagModel, Viewinstellingen> = Lens.fromProp<LaagModel>()("viewinstellingen");
  export const zoomLens: Lens<LaagModel, number> = Lens.fromPath<LaagModel>()(["viewinstellingen", "zoom"]);
  export const extentLens: Lens<LaagModel, ol.Extent> = Lens.fromPath<LaagModel>()(["viewinstellingen", "extent"]);

  const locationTransformer: Function1<ke.VeldInfo[], [Endomorphism<ColumnHeader[]>, Endomorphism<Row>]> = veldinfos => {
    // We moeten op label werken, want de gegevens zitten op verschillende plaatsen bij verschillende lagen
    const veldlabels = veldinfos.map(ke.VeldInfo.veldlabelLens.get);
    const wegLabel = "Ident8";
    const maybeWegKey = array.findFirst(veldinfos, vi => vi.label === wegLabel).map(ke.VeldInfo.veldnaamLens.get);
    return maybeWegKey.fold([identity, identity] as [Endomorphism<ColumnHeader[]>, Endomorphism<Row>], wegKey => {
      const afstandLabels = ["Van refpunt", "Van afst", "Tot refpunt", "Tot afst"];
      const allLabelsPresent = afstandLabels.filter(label => veldlabels.includes(label)).length === afstandLabels.length; // alles of niks!
      const locationLabels = allLabelsPresent ? afstandLabels : [];

      const locationKeys = array.array.filterMap(locationLabels, label =>
        array.findFirst(veldinfos, vi => vi.label === label).map(ke.VeldInfo.veldnaamLens.get)
      );

      const allLocationLabels = array.cons(wegLabel, locationLabels);
      const headersTrf: Endomorphism<ColumnHeader[]> = headers =>
        array.cons({ key: "syntheticLocation", label: "Locatie" }, headers).filter(header => !allLocationLabels.includes(header.label));

      const distance: Function2<number, number, string> = (ref, offset) => (offset >= 0 ? `${ref} +${offset}` : `${ref} ${offset}`);

      const rowTrf: Endomorphism<Row> = row => {
        const maybeWegValue = row[wegKey];
        const maybeDistances: Option<number[]> = traversable
          .sequence(option.option, array.array)(locationKeys.map(key => row[key].maybeValue.filter(isNumber)))
          .filter(ns => ns.length === afstandLabels.length);
        const locatieField: Field = {
          maybeValue: maybeWegValue.maybeValue
            .map(wegValue =>
              maybeDistances.fold(
                `${wegValue}`,
                distances => `${wegValue} van ${distance(distances[0], distances[1])} tot ${distance(distances[2], distances[3])}`
              )
            )
            .orElse(() => option.some("Geen weglocatie"))
        };
        return Row.addField("syntheticLocation", locatieField)(row);
      };
      return [headersTrf, rowTrf] as [Endomorphism<ColumnHeader[]>, Endomorphism<Row>];
    });
  };

  export const create: PartialFunction2<ke.ToegevoegdeVectorLaag, Viewinstellingen, LaagModel> = (laag, viewinstellingen) =>
    ke.ToegevoegdeVectorLaag.noSqlFsSourceFold.headOption(laag).map(source => {
      // We mogen niet zomaar alle velden gebruiken. Om te beginnen enkel de bassisvelden en de locatievelden moeten
      // afzonderlijk behandeld worden.
      const veldinfos = ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag);
      const selectedVeldnamen = veldinfos.filter(vi => vi.isBasisVeld).map(ke.VeldInfo.veldnaamLens.get);
      const baseColumnHeaders: ColumnHeader[] = veldinfos
        .filter(vi => selectedVeldnamen.includes(vi.naam))
        .map(vi => ({
          key: vi.naam,
          label: option.fromNullable(vi.label).getOrElse(vi.naam)
        }));
      const [headersTransformer, rowTransformer] = locationTransformer(veldinfos);
      const headers = ColumnHeaders.create(headersTransformer(baseColumnHeaders));
      return {
        titel: laag.titel,
        veldinfos,
        totaal: laag.filterinstellingen.totaal,
        featureCount: FeatureCount.pending,
        selectedVeldnamen,
        headers,
        source,
        page: option.none,
        nextPageUpdate: 0,
        updatePending: true,
        viewinstellingen,
        rowTransformer
      };
    });

  export const isExpectedPage: Function1<number, Prism<LaagModel, LaagModel>> = sequenceNumber =>
    Prism.fromPredicate(laag => laag.nextPageUpdate === sequenceNumber);
}

export namespace TableModel {
  export const empty: Function1<Viewinstellingen, TableModel> = viewinstellingen => ({
    laagData: [],
    viewinstellingen
  });

  export const Update: Function2<SyncUpdate, AsyncUpdate, Update> = (syncUpdate, asyncUpdate) => ({
    syncUpdate,
    asyncUpdate
  });

  export const syncUpdateOnly: Function1<SyncUpdate, Update> = flip(curry(Update))(constant(rx.EMPTY));

  const laagDataLens: Lens<TableModel, LaagModel[]> = Lens.fromProp<TableModel>()("laagData");
  const viewinstellingLens: Lens<TableModel, Viewinstellingen> = Lens.fromProp<TableModel>()("viewinstellingen");

  const isFeatureCountPending: Predicate<LaagModel> = pipe(
    LaagModel.aantalFeaturesLens.get,
    FeatureCount.isPending
  );

  const laagForTitelTraversal: Function1<string, Traversal<TableModel, LaagModel>> = titel => {
    return laagDataLens.composeTraversal(selectiveArrayTraversal(tl => tl.titel === titel));
  };

  const allLagenTraversal: Traversal<TableModel, LaagModel> = laagDataLens.composeTraversal(fromTraversable(array.array)<LaagModel>());

  export const laagForTitelOnLaagData: Curried2<string, LaagModel[], Option<LaagModel>> = titel => laagData =>
    array.findFirst(laagData, laag => laag.titel === titel);

  export const laagForTitel: Curried2<string, TableModel, Option<LaagModel>> = titel => model => {
    // asFold geeft een bug: Zie https://github.com/gcanti/monocle-ts/issues/96
    // return laagForTitelTraversal(titel).asFold().headOption;
    return laagForTitelOnLaagData(titel)(model.laagData);
  };

  export const headersForTitel: Curried2<string, TableModel, Option<ColumnHeaders>> = titel => {
    // return laagForTitelTraversal(titel)
    //   .composeLens(headersLens)
    //   .asFold().headOption;
    return model => array.findFirst(laagDataLens.get(model), laag => laag.titel === titel).map(LaagModel.headersLens.get);
  };

  const currentPageForTitelTraversal: Function1<string, Traversal<TableModel, Page>> = titel =>
    laagForTitelTraversal(titel).composeOptional(LaagModel.pageOptional);

  export const currentPageForTitel: Curried2<string, TableModel, Option<Page>> = titel => {
    // return currentPageForTitelTraversal(titel).asFold().headOption;
    return model => laagForTitel(titel)(model).chain(LaagModel.pageLens.get);
  };

  // Uiteraard moet er ook nog gesorteerd en tot de extent beperkt worden.
  const noSqlFsPage: Function2<LaagModel, number, Page> = (laag, pageNumber) => {
    console.log("****Fetching ", pageNumber, " for ", laag.titel);
    return Page(
      array.take(
        PageSize,
        laag.source.getFeaturesInExtent(laag.viewinstellingen.extent).map(
          flow(
            featureToRow(laag.veldinfos),
            laag.rowTransformer
          )
        )
      ),
      pageNumber
    );
  };

  const noSqlFsCount: Function1<LaagModel, FeatureCount> = laag =>
    FeatureCount.createFetched(laag.source.getFeaturesInExtent(laag.viewinstellingen.extent).length);

  // Zet de binnenkomende pagina indien diens sequenceNumber dat is dat we verwachten
  const pageUpdate: Function2<LaagModel, Page, SyncUpdate> = (laag, page) =>
    laagForTitelTraversal(laag.titel)
      .composePrism(LaagModel.isExpectedPage(laag.nextPageUpdate))
      .modify(applySequential([LaagModel.pageLens.set(option.some(page)), LaagModel.updatePendingLens.set(false)]));

  const featureCountUpdate: Function2<LaagModel, FeatureCount, SyncUpdate> = (laag, count) =>
    laagForTitelTraversal(laag.titel).modify(LaagModel.aantalFeaturesLens.set(count));

  const fetchTableTotals: AsyncUpdate = model =>
    rx.timer(2000).pipe(
      take(1),
      switchMap(() => rx.from(model.laagData.filter(isFeatureCountPending).map(laag => featureCountUpdate(laag, noSqlFsCount(laag)))))
    );

  // We willen hier niet de state voor alle lagen opnieuw initialiseren. We moeten enkel de nieuwe lagen toevoegen en de
  // oude verwijderen.
  export const updateLagen: Function1<ke.ToegevoegdeVectorLaag[], Update> = lagen => {
    return Update(
      model =>
        laagDataLens.modify(laagData =>
          array.catOptions(
            // Deze constructie met eerst iteren over lagen is gekozen om de volgorde zoals in de lagenkiezer te behouden
            lagen.map(laag => laagForTitelOnLaagData(laag.titel)(laagData).orElse(() => LaagModel.create(laag, model.viewinstellingen)))
          )
        )(model),
      model =>
        rx.merge(
          // De eerste page ophalen van alle nieuwe lagen ophalen
          rx.timer(2000).pipe(
            take(1), // bij de start zijn de features nog niet geladen. beter uiteraard wachten op event van source
            switchMap(() =>
              rx.from(
                model.laagData
                  .filter(laag => laag.updatePending) // risico om zelfde data 2x op te vragen indien vorige toevoeging nog niet verwerkt
                  .map(laag => pageUpdate(laag, noSqlFsPage(laag, 0)))
              )
            )
          ),
          fetchTableTotals(model)
        )
    );
  };

  export const updateZoomAndExtent: Function1<Viewinstellingen, Update> = vi =>
    Update(
      applySequential([
        viewinstellingLens.set(vi), //
        allLagenTraversal.composeLens(LaagModel.viewinstellingLens).set(vi)
      ]),
      model =>
        rx.merge(
          rx.from(model.laagData.map(laag => pageUpdate(laag, noSqlFsPage(laag, laag.page.fold(0, page => page.pageNumber))))),
          rx.from(model.laagData.map(laag => featureCountUpdate(laag, noSqlFsCount(laag))))
        )
    );
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
