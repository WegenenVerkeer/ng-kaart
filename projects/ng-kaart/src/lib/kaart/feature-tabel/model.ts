import { array, option, ord, record, setoid, traversable } from "fp-ts";
import { constant, Curried2, curry, Endomorphism, flip, flow, Function1, Function2, identity, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import { getLastSemigroup } from "fp-ts/lib/Semigroup";
import { Setoid } from "fp-ts/lib/Setoid";
import { fromTraversable, Getter, Lens, Optional, Prism, Traversal } from "monocle-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map } from "rxjs/operators";
import { isNumber } from "util";

import { Filter, FilterTotaal, isTotaalOpgehaald } from "../../filter";
import { NosqlFsSource } from "../../source";
import * as arrays from "../../util/arrays";
import { applySequential, PartialFunction2 } from "../../util/function";
import { arrayTraversal, selectiveArrayTraversal } from "../../util/lenses";
import * as ke from "../kaart-elementen";
import { Viewinstellingen } from "../kaart-protocol-subscriptions";

import { FeatureCount, FeatureCountFetcher, Field, FieldSorting, Page, PageFetcher, PageNumber, Row, SortDirection } from "./data-provider";

export type SyncUpdate = Endomorphism<TableModel>;
export type AsyncUpdate = Function1<TableModel, rx.Observable<SyncUpdate>>;

export interface Update {
  readonly syncUpdate: SyncUpdate;
  readonly asyncUpdate: AsyncUpdate;
}

export interface TableModel {
  readonly laagData: LaagModel[];

  // andere globale eigenschappen
  readonly viewinstellingen: Viewinstellingen;
}

export interface FieldSelection {
  readonly name: string;
  readonly label: string;
  readonly selected: boolean;
  readonly sortDirection: Option<SortDirection>;
  readonly contributingVeldinfos: ke.VeldInfo[]; // voor de synthetische velden
}

export type RowFormatter = Endomorphism<Row>;

// Deze interface verzamelt de gegevens die we nodig hebben om 1 laag weer te geven in de tabelview. Het is
// tegelijkertijd een abstractie van het onderliggende model + state nodig voor de tabel use cases (MVP).
export interface LaagModel {
  readonly titel: string;
  readonly veldinfos: ke.VeldInfo[]; // enkel de VeldInfos die we kunnen weergeven
  readonly hasFilter: boolean;
  readonly filterIsActive: boolean;
  readonly mapAsFilter: boolean;
  readonly canUseAllFeatures: boolean; // geeft aan dat mogelijk is om meer dan de features op de zichtbare kaart te tonen
  readonly featureCount: FeatureCount; // aantal features in de tabel over alle pagina's heen
  readonly expectedPageNumber: PageNumber; // Het PageNumber dat we verwachten te zien. Potentieel anders dan in Page wegens asynchoniciteit
  readonly page: Option<Page>; // We houden maar 1 pagina van data tegelijkertijd in het geheugen. (later meer)

  readonly fieldSelections: FieldSelection[]; // enkel een subset van de velden is zichtbaar
  readonly fieldSortings: FieldSorting[];
  readonly rowTransformer: Endomorphism<Row>; // bewerkt de ruwe rij (bijv. locatieveld toevoegen)
  readonly rowFormats: RowFormatSpec; // instructies om velden aan te passen.
  readonly rowFormatter: RowFormatter; // formateert een rij. zou kunnen in rowTransformer zitten, maar heeft andere life cycle

  readonly source: NosqlFsSource;
  readonly minZoom: number;
  readonly maxZoom: number;

  // volgende 4 properties worden voorlopig niet meer gebruikt. Misschien wel weer wanneer volledige dataset ipv view
  // gebruikt wordt.
  readonly nextPageSequence: number; // Het sequentienummer dat verwacht is, niet het paginanummer
  readonly updatePending: boolean;
  readonly pageFetcher: PageFetcher; // Voorlopig niet meer gebruikt
  readonly featureCountFetcher: FeatureCountFetcher;

  readonly viewinstellingen: Viewinstellingen; // Kopie van gegevens in TableModel. Handig om hier te refereren

  // later
  // readonly canRequestFullData: boolean;
  // readonly fetchAllData();  --> of nog beter in losse functie?
  // readonly viewAsFilter: boolean;
}

// De titel van een laag + geassocieerde state
export interface TableHeader {
  readonly titel: string;
  readonly filterIsActive: boolean;
  readonly hasFilter: boolean;
  readonly count: number | undefined;
}

// Een RowFormatSpec laat toe om veldwaarden om te zetten naar een andere representatie. Een transformatiefunctie obv
// een RowFormatSpec wordt heel vroeg bij het interpreteren van de laag VeldInfo aangemaakt omdat die voor alle rijen
// dezelfde is. Zoals altijd geldt dat een
export type RowFormatSpec = Record<string, Endomorphism<Field>>;

export namespace FieldSelection {
  export const nameLens: Lens<FieldSelection, string> = Lens.fromProp<FieldSelection>()("name");
  export const selectedLens: Lens<FieldSelection, boolean> = Lens.fromProp<FieldSelection>()("selected");
  export const contributingVeldinfosGetter: Getter<FieldSelection, ke.VeldInfo[]> = Lens.fromProp<FieldSelection>()(
    "contributingVeldinfos"
  ).asGetter();
  export const maybeSortDirectionLens: Lens<FieldSelection, Option<SortDirection>> = Lens.fromProp<FieldSelection>()("sortDirection");

  export const fieldsFromVeldinfo: Function1<ke.VeldInfo[], FieldSelection[]> = array.map(vi => ({
    name: vi.naam,
    label: ke.VeldInfo.veldGuaranteedLabelGetter.get(vi),
    selected: false,
    sortDirection: option.none,
    contributingVeldinfos: [vi]
  }));

  const isBaseField: Predicate<FieldSelection> = field => arrays.exists(ke.VeldInfo.isBasisveldLens.get)(field.contributingVeldinfos);

  export const selectBaseFields: Endomorphism<FieldSelection[]> = arrayTraversal<FieldSelection>().modify(field =>
    selectedLens.set(isBaseField(field))(field)
  );

  export const selectAllFields: Endomorphism<FieldSelection[]> = arrayTraversal<FieldSelection>().modify(selectedLens.set(true));

  export const selectedVeldnamen: Function1<FieldSelection[], string[]> = flow(
    array.filter(selectedLens.get),
    array.map(nameLens.get)
  );

  export const setoidFieldSelection: Setoid<FieldSelection> = setoid.getStructSetoid({
    name: setoid.setoidString,
    selected: setoid.setoidBoolean,
    sortDirection: option.getSetoid(SortDirection.setoidSortDirection)
  });

  export const setoidFieldSelectionByKey: Setoid<FieldSelection> = setoid.contramap(nameLens.get, setoid.setoidString);

  export const selectFirstField: Endomorphism<FieldSelection[]> = fields =>
    array.mapWithIndex<FieldSelection, FieldSelection>((i, field) => selectedLens.modify(set => set || i === 0)(field))(fields);

  const sortingsForFieldSelection: Function1<FieldSelection, FieldSorting[]> = fs =>
    fs.sortDirection.foldL(() => [], direction => fs.contributingVeldinfos.map(FieldSorting.create(direction)));

  export const maintainFieldSortings: Function1<FieldSelection[], FieldSorting[]> = array.chain(sortingsForFieldSelection);
}

export namespace TableHeader {
  export const filterIsActiveLens: Lens<TableHeader, boolean> = Lens.fromProp<TableHeader>()("filterIsActive");

  export const toHeader: Function1<LaagModel, TableHeader> = laag => ({
    titel: laag.titel,
    filterIsActive: laag.filterIsActive,
    hasFilter: laag.hasFilter,
    count: laag.featureCount.kind === "FeatureCountPending" ? undefined : laag.featureCount.count
  });

  export const setoidTableHeader: Setoid<TableHeader> = setoid.getStructSetoid({
    titel: setoid.setoidString,
    filterIsActive: setoid.setoidBoolean,
    hasFilter: setoid.setoidBoolean,
    count: setoid.setoidNumber
  });
}

export namespace LaagModel {
  type LaagModelLens<A> = Lens<LaagModel, A>;
  type LaagModelGetter<A> = Getter<LaagModel, A>;
  const laagPropLens = Lens.fromProp<LaagModel>();

  export const titelLens: LaagModelLens<string> = laagPropLens("titel");
  export const pageOptional: Optional<LaagModel, Page> = Optional.fromOptionProp<LaagModel>()("page");
  export const expectedPageNumberLens: LaagModelLens<PageNumber> = laagPropLens("expectedPageNumber");
  export const pageLens: LaagModelLens<Option<Page>> = laagPropLens("page");
  export const nextPageSequenceLens: LaagModelLens<number> = laagPropLens("nextPageSequence");
  export const updatePendingLens: LaagModelLens<boolean> = laagPropLens("updatePending");
  export const aantalFeaturesLens: LaagModelLens<FeatureCount> = laagPropLens("featureCount");
  export const viewinstellingLens: LaagModelLens<Viewinstellingen> = laagPropLens("viewinstellingen");
  export const zoomLens: LaagModelLens<number> = Lens.fromPath<LaagModel>()(["viewinstellingen", "zoom"]);
  export const extentLens: LaagModelLens<ol.Extent> = Lens.fromPath<LaagModel>()(["viewinstellingen", "extent"]);
  export const hasFilterLens: LaagModelLens<boolean> = laagPropLens("hasFilter");
  export const filterIsActiveLens: LaagModelLens<boolean> = laagPropLens("filterIsActive");
  export const veldInfosGetter: LaagModelGetter<ke.VeldInfo[]> = laagPropLens("veldinfos").asGetter();
  const unsafeMapAsFilterLens: LaagModelLens<boolean> = laagPropLens("mapAsFilter");
  export const mapAsFilterGetter: LaagModelGetter<boolean> = unsafeMapAsFilterLens.asGetter();
  const unsafeFieldSortingsLens: LaagModelLens<FieldSorting[]> = laagPropLens("fieldSortings");
  const unsafeFieldSelectionsLens: LaagModelLens<FieldSelection[]> = laagPropLens("fieldSelections");
  const unsafeRowFormatterLens: LaagModelLens<Endomorphism<Row>> = laagPropLens("rowFormatter");
  export const fieldSelectionsLens: LaagModelLens<FieldSelection[]> = new Lens(
    unsafeFieldSelectionsLens.get, //
    fieldSelections => {
      const fixedFieldSelections = FieldSelection.selectFirstField(fieldSelections);
      return laag =>
        pipe(
          laag,
          unsafeFieldSelectionsLens.set(fixedFieldSelections),
          unsafeFieldSortingsLens.set(FieldSelection.maintainFieldSortings(fixedFieldSelections)),
          unsafeRowFormatterLens.set(rowFormatterForFields(fixedFieldSelections, laag.rowFormats))
        );
    }
  );
  const canUseAllFeaturesLens: LaagModelLens<boolean> = laagPropLens("canUseAllFeatures");
  export const canUseAllFeaturesGetter: LaagModelGetter<boolean> = canUseAllFeaturesLens.asGetter();

  export const fieldSelectionForNameTraversal: Function1<string, Traversal<LaagModel, FieldSelection>> = fieldName =>
    fieldSelectionsLens.composeTraversal(selectiveArrayTraversal(fs => fs.name === fieldName));
  const fieldSelectionTraversal: Traversal<LaagModel, FieldSelection> = fieldSelectionsLens.composeTraversal(arrayTraversal());

  export const clampExpectedPageNumber: Endomorphism<LaagModel> = laag =>
    expectedPageNumberLens.modify(
      ord.clamp(Page.ordPageNumber)(Page.first, Page.last(FeatureCount.fetchedCount(laag.featureCount).getOrElse(0)))
    )(laag);

  // Bepaalde velden moeten samengevoegd worden tot 1 synthetisch locatieveld. Daarvoor moeten we enerzijds de headers
  // aanpassen en anderzijds elke Row die binnen komt.
  const locationTransformer: Function1<ke.VeldInfo[], [Endomorphism<FieldSelection[]>, Endomorphism<Row>]> = veldinfos => {
    // We moeten op label werken, want de gegevens zitten op verschillende plaatsen bij verschillende lagen
    const veldlabels = veldinfos.map(ke.VeldInfo.veldlabelLens.get);
    const wegLabel = "Ident8";
    const afstandLabels = ["Van refpunt", "Van afst", "Tot refpunt", "Tot afst"];
    const maybeWegKey = array.findFirst(veldinfos, vi => vi.label === wegLabel).map(ke.VeldInfo.veldnaamLens.get);
    return maybeWegKey.fold([identity, identity] as [Endomorphism<FieldSelection[]>, Endomorphism<Row>], wegKey => {
      const allLabelsPresent = afstandLabels.filter(label => veldlabels.includes(label)).length === afstandLabels.length; // alles of niks!
      const locationLabels = allLabelsPresent ? afstandLabels : [];

      const locationKeys = array.array.filterMap(locationLabels, label =>
        array.findFirst(veldinfos, vi => vi.label === label).map(ke.VeldInfo.veldnaamLens.get)
      );

      const allLocationLabels = array.cons(wegLabel, locationLabels);
      const allLocationKeys = array.cons(wegKey, locationKeys);
      const allLocationVeldinfos = array.filterMap(key => array.findFirst<ke.VeldInfo>(vi => vi.naam === key)(veldinfos))(allLocationKeys);

      const locationFieldSelection: FieldSelection = {
        name: "syntheticLocation",
        label: "Locatie",
        selected: true,
        sortDirection: option.some("ASCENDING" as "ASCENDING"),
        contributingVeldinfos: allLocationVeldinfos
      };
      const fieldsSelectionTrf: Endomorphism<FieldSelection[]> = fieldSelections =>
        array
          .cons(locationFieldSelection, fieldSelections) // Het synthetische veld toevoegen
          .filter(fieldSelection => !allLocationLabels.includes(fieldSelection.label)); // en de bijdragende velden verwijderen

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
            .orElse(() => option.some("<Geen weglocatie>"))
        };
        return Row.addField("syntheticLocation", locatieField)(row);
      };
      return [fieldsSelectionTrf, rowTrf] as [Endomorphism<FieldSelection[]>, Endomorphism<Row>];
    });
  };

  const formatBoolean: Endomorphism<Field> = field => ({ maybeValue: field.maybeValue.map(value => (value ? "JA" : "NEEN")) });
  const rowFormat: Function1<ke.VeldInfo, Option<Endomorphism<Field>>> = vi =>
    vi.type === "boolean" ? option.some(formatBoolean) : option.none;
  const rowFormatsFromVeldinfos: Function1<ke.VeldInfo[], RowFormatSpec> = veldinfos =>
    pipe(
      record.fromFoldableMap(getLastSemigroup<ke.VeldInfo>(), array.array)(veldinfos, vi => [vi.naam, vi]),
      record.filterMap(rowFormat)
    );

  const fieldFormatter: Function2<string[], RowFormatSpec, Function2<string, Field, Field>> = (selectedFieldNames, formats) => (
    fieldName,
    field
  ) =>
    array.elem(setoid.setoidString)(fieldName, selectedFieldNames)
      ? record
          .lookup(fieldName, formats)
          .map(f => f(field))
          .getOrElse(field)
      : field;

  // Deze formatteert de waarden in de rij (enkel voor de geselecteerde kolommen). Dit is nu een transformatie van Row.
  // Misschien is het nuttig om nog een ander concept in te voeren (FormattedRow?). In elk geval is dit een verzameling
  // van functies die berekend worden op het moment dat de FieldSelections bekend zijn, zodat bij het transformeren van
  // een rij enkel de transformaties zelf uitgevoerd moeten worden, en niet de berekening van welke er nodig zijn.
  const rowFormatterForFields: Function2<FieldSelection[], RowFormatSpec, Endomorphism<Row>> = (fieldSelections, rowFormats) =>
    pipe(
      fieldSelections,
      array.filter(FieldSelection.selectedLens.get),
      array.map(FieldSelection.nameLens.get), // we willen enkel de namen van de zichtbare kolommen
      selectedFieldNames => record.mapWithIndex(fieldFormatter(selectedFieldNames, rowFormats))
    );

  export const create: PartialFunction2<ke.ToegevoegdeVectorLaag, Viewinstellingen, LaagModel> = (laag, viewinstellingen) =>
    ke.ToegevoegdeVectorLaag.noSqlFsSourceFold.headOption(laag).map(source => {
      // We mogen niet zomaar alle velden gebruiken. Om te beginnen enkel de basisvelden en de locatievelden moeten
      // afzonderlijk behandeld worden.
      const veldinfos = ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag);
      const [fieldsTransformer, rowTransformer] = locationTransformer(veldinfos);
      const fieldSelections = pipe(
        veldinfos,
        FieldSelection.fieldsFromVeldinfo,
        fieldsTransformer,
        FieldSelection.selectBaseFields
      );

      const pageFetcher = PageFetcher.sourceBasedPageFetcher(laag.bron.source);
      const featureCountFetcher = FeatureCountFetcher.sourceBasedFeatureCountFetcher(laag.bron.source);

      const firstField = array.take(1, fieldSelections);
      const contributingVeldinfos = array.chain(FieldSelection.contributingVeldinfosGetter.get)(firstField);
      const fieldSortings = contributingVeldinfos.map(FieldSorting.create("ASCENDING"));
      const rowFormats = rowFormatsFromVeldinfos(veldinfos);
      const rowFormatter = rowFormatterForFields(fieldSelections, rowFormats);

      return {
        titel: laag.titel,
        veldinfos,
        hasFilter: Filter.isDefined(laag.filterinstellingen.spec),
        filterIsActive: laag.filterinstellingen.actief,
        mapAsFilter: true,
        totaal: laag.filterinstellingen.totaal,
        canUseAllFeatures: false,
        featureCount: FeatureCount.pending,
        expectedPageNumber: Page.first,
        fieldSelections,
        fieldSortings,
        rowFormats,
        rowFormatter,
        source,
        minZoom: laag.bron.minZoom,
        maxZoom: laag.bron.maxZoom,
        page: option.none,
        nextPageSequence: 0,
        updatePending: true,
        viewinstellingen,
        rowTransformer,
        pageFetcher,
        featureCountFetcher
      };
    });

  export const isExpectedPage: Function1<number, Prism<LaagModel, LaagModel>> = sequenceNumber =>
    Prism.fromPredicate(laag => laag.nextPageSequence === sequenceNumber);

  export const isOnFirstPage: Predicate<LaagModel> = laag => laag.page.map(Page.pageNumberLens.get).exists(Page.isFirst);
  export const isOnLastPage: Predicate<LaagModel> = laag =>
    FeatureCount.fetchedCount(laag.featureCount).fold(
      true, //
      featureCount => laag.page.map(Page.pageNumberLens.get).exists(Page.isTop(Page.last(featureCount)))
    );
  export const hasMultiplePages: Predicate<LaagModel> = laag =>
    FeatureCount.fetchedCount(laag.featureCount).fold(false, featureCount => !Page.isFirst(Page.last(featureCount)));

  const toggleSortDirection: Endomorphism<Option<SortDirection>> = flow(
    option.map(SortDirection.invert),
    option.alt(() => option.some("ASCENDING") as Option<"ASCENDING">)
  );

  // Vervangt de huidige sortingFields door een sorting op 1 enkel logisch veld
  export const toggleSortingField: Function1<string, Endomorphism<LaagModel>> = fieldName => laag =>
    pipe(
      fieldSelectionsLens.get(laag),
      array.findFirst(fs => fs.name === fieldName), // Het veld moet bestaan (anders zouden we zonder sortering kunnen eindigen)
      option.fold(
        () => identity, // als het toch niet bestaat, wijzigen we niets
        fs =>
          flow(
            // Eerst alle sorts wissen
            fieldSelectionTraversal.composeLens(FieldSelection.maybeSortDirectionLens).set(option.none),
            // En daarna het (zeker bestaande) veld een andere sortering geven. Set ipv modify omdat in vorige stap
            // alles gereset is.
            fieldSelectionForNameTraversal(fieldName)
              .composeLens(FieldSelection.maybeSortDirectionLens)
              .set(toggleSortDirection(fs.sortDirection))
          )
      )
    )(laag);

  export const setMapAsFilter: Function1<boolean, Endomorphism<LaagModel>> = unsafeMapAsFilterLens.set;

  export const setCanUseAllFeatures: Function1<boolean, Endomorphism<LaagModel>> = canUseAllFeaturesLens.set;
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

  const laagForTitelTraversal: Function1<string, Traversal<TableModel, LaagModel>> = titel =>
    laagDataLens.composeTraversal(selectiveArrayTraversal(tl => tl.titel === titel));

  const allLagenTraversal: Traversal<TableModel, LaagModel> = laagDataLens.composeTraversal(fromTraversable(array.array)<LaagModel>());

  export const laagForTitelOnLaagData: Curried2<string, LaagModel[], Option<LaagModel>> = titel => laagData =>
    array.findFirst(laagData, laag => laag.titel === titel);

  export const laagForTitel: Curried2<string, TableModel, Option<LaagModel>> = titel => model => {
    // asFold geeft een bug: Zie https://github.com/gcanti/monocle-ts/issues/96
    // return laagForTitelTraversal(titel).asFold().headOption;
    return laagForTitelOnLaagData(titel)(model.laagData);
  };

  export const currentPageForTitel: Curried2<string, TableModel, Option<Page>> = titel => {
    // return currentPageForTitelTraversal(titel).asFold().headOption;
    return model => laagForTitel(titel)(model).chain(LaagModel.pageLens.get);
  };

  // We willen hier niet de state voor alle lagen opnieuw initialiseren. We moeten enkel de nieuwe lagen toevoegen en de
  // oude verwijderen. Van de bestaande moeten we de state aanpassen indien nodig.
  export const updateLagen: Function1<ke.ToegevoegdeVectorLaag[], Update> = lagen => {
    const updateFilterInstellingen: Function1<ke.Laagfilterinstellingen, Endomorphism<LaagModel>> = instellingen =>
      flow(
        LaagModel.filterIsActiveLens.set(instellingen.actief),
        LaagModel.hasFilterLens.set(Filter.isDefined(instellingen.spec))
      );

    return Update(
      model =>
        laagDataLens.modify(laagData =>
          array.array.filterMap(
            lagen,
            laag =>
              laagForTitelOnLaagData(laag.titel)(laagData) // kennen we die laag al?
                .map(updateFilterInstellingen(laag.filterinstellingen)) // pas ze dan aan
                .orElse(() => LaagModel.create(laag, model.viewinstellingen)) // of creeer er een nieuw model voor
          )
        )(model),
      () =>
        rx
          .merge
          // ...model.laagData.filter(LaagModel.updatePendingLens.get).map(asyncLaagPageUpdate),
          // ...model.laagData.map(asyncFeatureCountUpdate)
          ()
    );
  };

  export const updateZoomAndExtent: Function1<Viewinstellingen, Update> = vi =>
    Update(
      applySequential([
        viewinstellingLens.set(vi), // zorg dat de nieuwe extent globaal bekend is
        allLagenTraversal.modify(
          flow(
            LaagModel.viewinstellingLens.set(vi), // en in alle lagen
            LaagModel.updatePendingLens.set(true) // en maak de laag klaar om een page te ontvangen
          )
        )
      ]),
      () =>
        rx
          .merge
          // ...model.laagData.map(asyncLaagPageUpdate), //
          // ...model.laagData.map(asyncFeatureCountUpdate)
          ()
    );

  const inZoom = (ifInZoom: Endomorphism<LaagModel>, ifOutsideZoom: Endomorphism<LaagModel>): Endomorphism<LaagModel> => laag =>
    (laag.viewinstellingen.zoom >= laag.minZoom && laag.viewinstellingen.zoom <= laag.maxZoom ? ifInZoom : ifOutsideZoom)(laag);

  const updateLaagPageData: Endomorphism<LaagModel> = laag =>
    LaagModel.pageLens.set(
      option.some(
        PageFetcher.pageFromSource(laag.source, {
          dataExtent: laag.viewinstellingen.extent,
          fieldSortings: laag.fieldSortings,
          pageNumber: laag.expectedPageNumber,
          rowCreator: flow(
            Row.featureToRow(laag.veldinfos),
            laag.rowTransformer,
            laag.rowFormatter
          ),
          requestSequence: laag.nextPageSequence
        })
      )
    )(laag);

  const clampLaagPageNumber: Endomorphism<LaagModel> = LaagModel.pageOptional.modify(page =>
    Page.pageNumberLens.modify(ord.clamp(Page.ordPageNumber)(Page.first, page.lastPageNumber))(page)
  );

  const clearLaagPage: Endomorphism<LaagModel> = LaagModel.pageLens.set(option.none);

  const updateLaagFeatureCount: Endomorphism<LaagModel> = laag =>
    LaagModel.aantalFeaturesLens.set(FeatureCountFetcher.countFromSource(laag.source, { dataExtent: laag.viewinstellingen.extent }))(laag);

  // TODO: misschien beter specifiek type voor buiten zoom
  const clearLaagFeatureCount: Endomorphism<LaagModel> = LaagModel.aantalFeaturesLens.set(FeatureCount.createFetched(0));

  const syncUpdateLaagWithTitel: Curried2<string, Endomorphism<LaagModel>, Update> = titel => f =>
    syncUpdateOnly(laagForTitelTraversal(titel).modify(f));

  export const featuresUpdate: Function1<ke.ToegevoegdeVectorLaag, Update> = tvlg =>
    syncUpdateLaagWithTitel(tvlg.titel)(
      inZoom(
        flow(
          updateLaagFeatureCount,
          clampLaagPageNumber,
          updateLaagPageData
        ),
        flow(
          clearLaagPage,
          clearLaagFeatureCount
        )
      )
    );

  export const followViewFeatureUpdates: Function1<ke.ToegevoegdeVectorLaag, rx.Observable<Update>> = tvlg =>
    ke.ToegevoegdeVectorLaag.featuresChanged$(tvlg).pipe(map(() => featuresUpdate(tvlg)));

  const totaalUpdate: Curried2<ke.ToegevoegdeVectorLaag, FilterTotaal, Update> = tvlg => totaal =>
    syncUpdateLaagWithTitel(tvlg.titel)(
      pipe(
        totaal,
        isTotaalOpgehaald, // We gebruiken op deze manier automatisch hetzelfde aantal features als grens als voor filters
        LaagModel.setCanUseAllFeatures
      )
    );

  export const followTotalFeaturesUpdate: Function1<ke.ToegevoegdeVectorLaag, rx.Observable<Update>> = tvlg =>
    ke.ToegevoegdeVectorLaag.noSqlFsSourceFold
      .headOption(tvlg)
      .map(source => source.fetchTotal$().pipe(map(totaalUpdate(tvlg))))
      .getOrElse(rx.EMPTY);

  const modifyPageNumberUpdate: Curried2<Endomorphism<PageNumber>, string, Update> = f => titel =>
    syncUpdateLaagWithTitel(titel)(
      flow(
        LaagModel.expectedPageNumberLens.modify(f),
        LaagModel.clampExpectedPageNumber,
        updateLaagPageData
      )
    );

  export const previousPageUpdate: Function1<string, Update> = modifyPageNumberUpdate(Page.previous);

  export const nextPageUpdate: Function1<string, Update> = modifyPageNumberUpdate(Page.next);

  export const setPageNumberUpdate: Curried2<string, number, Update> = titel => pageNr => modifyPageNumberUpdate(Page.set(pageNr))(titel);

  export const chooseBaseFieldsUpdate: Function1<string, Update> = titel =>
    syncUpdateLaagWithTitel(titel)(LaagModel.fieldSelectionsLens.modify(FieldSelection.selectBaseFields));

  export const chooseAllFieldsUpdate: Function1<string, Update> = titel =>
    syncUpdateLaagWithTitel(titel)(LaagModel.fieldSelectionsLens.modify(FieldSelection.selectAllFields));

  export const setFieldSelectedUpdate: Function1<string, Function2<string, boolean, Update>> = titel => (fieldName, value) =>
    syncUpdateLaagWithTitel(titel)(
      flow(
        LaagModel.fieldSelectionForNameTraversal(fieldName)
          .composeLens(FieldSelection.selectedLens)
          .set(value),
        updateLaagPageData
      )
    );

  export const sortFieldToggleUpdate: Curried2<string, string, Update> = titel => fieldName =>
    syncUpdateLaagWithTitel(titel)(
      flow(
        LaagModel.toggleSortingField(fieldName),
        updateLaagPageData
      )
    );

  export const mapAsFilterUpdate: Curried2<string, boolean, Update> = titel => onOff =>
    syncUpdateLaagWithTitel(titel)(
      flow(
        LaagModel.setMapAsFilter(onOff),
        updateLaagPageData
      )
    );
}
