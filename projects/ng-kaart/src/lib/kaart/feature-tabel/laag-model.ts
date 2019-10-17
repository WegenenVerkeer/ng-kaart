import { array, option, ord, record, setoid, traversable } from "fp-ts";
import { Curried2, Endomorphism, flow, Function1, Function2, identity, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { ordString } from "fp-ts/lib/Ord";
import { pipe } from "fp-ts/lib/pipeable";
import { getLastSemigroup } from "fp-ts/lib/Semigroup";
import { Getter, Lens, Optional, Traversal } from "monocle-ts";
import { indexArray } from "monocle-ts/lib/Index/Array";
import * as ol from "openlayers";
import { map } from "rxjs/operators";
import { isNumber } from "util";

import { Filter, FilterTotaal, match as FilterTotaalMatch } from "../../filter";
import { NosqlFsSource } from "../../source";
import * as arrays from "../../util/arrays";
import { equalToString } from "../../util/equal";
import { Feature } from "../../util/feature";
import { PartialFunction2 } from "../../util/function";
import { arrayTraversal, selectiveArrayTraversal } from "../../util/lenses";
import { subSpy } from "../../util/operators";
import * as ke from "../kaart-elementen";
import { Viewinstellingen } from "../kaart-protocol-subscriptions";

import {
  DataReady,
  DataRequest,
  FeatureCount,
  FeatureCountFetcher,
  FieldSorting,
  Page,
  PageFetcher,
  PageNumber,
  PageRequest,
  SortDirection
} from "./data-provider";
import { FieldSelection } from "./field-selection-model";
import { Field, FieldsFormatSpec, Row, Velden, VeldenFormatter } from "./row-model";
import { AsyncUpdate, SyncUpdate, Update } from "./update";

export type ViewSourceMode = "Map" | "AllFeatures";
export type SelectionViewMode = "SelectedOnly" | "SourceFeatures";

export interface LaagModel {
  readonly titel: string;
  readonly veldinfos: ke.VeldInfo[]; // enkel de VeldInfos die we kunnen weergeven
  readonly hasFilter: boolean;
  readonly filterIsActive: boolean;
  readonly viewSourceMode: ViewSourceMode;
  readonly selectionViewMode: SelectionViewMode;
  readonly canUseAllFeatures: boolean; // geeft aan dat mogelijk is om meer dan de features op de zichtbare kaart te tonen
  readonly featureCount: FeatureCount; // aantal features in de tabel over alle pagina's heen. Hangt af van viewsourcemode.
  // readonly fullFeatureCount: FeatureCount; // aantal features in de laag rekening houdend met de filter. Hangt niet af van viewsourcemode
  readonly expectedPageNumber: PageNumber; // Het PageNumber dat we verwachten te zien. Potentieel anders dan in Page wegens asynchoniciteit
  readonly page: Option<Page>; // We houden maar 1 pagina van data tegelijkertijd in het geheugen. (later meer)

  readonly fieldSelections: FieldSelection[]; // enkel een subset van de velden is zichtbaar
  readonly fieldSortings: FieldSorting[];
  readonly veldenTransformer: Endomorphism<Velden>; // bewerkt de ruwe rij (bijv. locatieveld toevoegen)
  readonly fieldFormats: FieldsFormatSpec; // instructies om velden aan te passen.
  readonly veldenFormatter: VeldenFormatter; // formateert een rij. zou kunnen in veldenTransformer zitten, maar heeft andere life cycle

  readonly source: NosqlFsSource;
  readonly minZoom: number;
  readonly maxZoom: number;

  readonly nextPageSequence: number; // Het sequentienummer dat verwacht is, niet het paginanummer
  readonly updatePending: boolean;

  readonly visibleFeatures: ol.Feature[]; // Alle features van de laag die momenteel zichtbaar zijn
  readonly selectedFeatures: ol.Feature[]; // Alle features van de laag die momenteel geselecteerd zijn. Niet noodzakelijk zichtbaar

  readonly viewinstellingen: Viewinstellingen; // Kopie van gegevens in TableModel. Handig om hier te refereren
}

export namespace LaagModel {
  export type LaagModelSyncUpdate = SyncUpdate<LaagModel>;
  export type LaagModelAsyncUpdate = AsyncUpdate<LaagModel>;
  export type LaagModelUpdate = Update<LaagModel>;

  type LaagModelLens<A> = Lens<LaagModel, A>;
  type LaagModelGetter<A> = Getter<LaagModel, A>;
  const laagPropLens = Lens.fromProp<LaagModel>();

  export const titelLens: LaagModelLens<string> = laagPropLens("titel");
  export const pageOptional: Optional<LaagModel, Page> = Optional.fromOptionProp<LaagModel>()("page");
  export const expectedPageNumberLens: LaagModelLens<PageNumber> = laagPropLens("expectedPageNumber");
  export const pageLens: LaagModelLens<Option<Page>> = laagPropLens("page");
  export const nextPageSequenceLens: LaagModelLens<number> = laagPropLens("nextPageSequence");
  export const updatePendingLens: LaagModelLens<boolean> = laagPropLens("updatePending");
  export const featureCountLens: LaagModelLens<FeatureCount> = laagPropLens("featureCount");
  // export const fullFeatureCountLens: LaagModelLens<FeatureCount> = laagPropLens("fullFeatureCount");
  export const viewinstellingenLens: LaagModelLens<Viewinstellingen> = laagPropLens("viewinstellingen");
  export const zoomLens: LaagModelLens<number> = Lens.fromPath<LaagModel>()(["viewinstellingen", "zoom"]);
  export const extentLens: LaagModelLens<ol.Extent> = Lens.fromPath<LaagModel>()(["viewinstellingen", "extent"]);
  export const hasFilterLens: LaagModelLens<boolean> = laagPropLens("hasFilter");
  export const filterIsActiveLens: LaagModelLens<boolean> = laagPropLens("filterIsActive");
  export const veldInfosGetter: LaagModelGetter<ke.VeldInfo[]> = laagPropLens("veldinfos").asGetter();
  const unsafeViewSourceModeLens: LaagModelLens<ViewSourceMode> = laagPropLens("viewSourceMode");
  const unsafeSelectionViewModeLens: LaagModelLens<SelectionViewMode> = laagPropLens("selectionViewMode");
  export const viewSourceModeGetter: LaagModelGetter<ViewSourceMode> = unsafeViewSourceModeLens.asGetter();
  export const selectionViewModeGetter: LaagModelGetter<SelectionViewMode> = unsafeSelectionViewModeLens.asGetter();
  const unsafeFieldSortingsLens: LaagModelLens<FieldSorting[]> = laagPropLens("fieldSortings");
  const unsafeFieldSelectionsLens: LaagModelLens<FieldSelection[]> = laagPropLens("fieldSelections");
  const unsafeVeldenFormatterLens: LaagModelLens<Endomorphism<Velden>> = laagPropLens("veldenFormatter");
  export const fieldSelectionsLens: LaagModelLens<FieldSelection[]> = new Lens(
    unsafeFieldSelectionsLens.get, //
    fieldSelections => {
      const fixedFieldSelections = FieldSelection.selectFirstField(fieldSelections);
      return laag =>
        pipe(
          laag,
          unsafeFieldSelectionsLens.set(fixedFieldSelections),
          unsafeFieldSortingsLens.set(FieldSelection.maintainFieldSortings(fixedFieldSelections)),
          unsafeVeldenFormatterLens.set(rowFormatterForFields(fixedFieldSelections, laag.fieldFormats))
        );
    }
  );
  const canUseAllFeaturesLens: LaagModelLens<boolean> = laagPropLens("canUseAllFeatures");
  export const canUseAllFeaturesGetter: LaagModelGetter<boolean> = canUseAllFeaturesLens.asGetter();
  export const visibleFeaturesLens: LaagModelLens<ol.Feature[]> = laagPropLens("visibleFeatures");
  export const selectedFeaturesLens: LaagModelLens<ol.Feature[]> = laagPropLens("selectedFeatures");

  const fieldSelectionForNameTraversal: Function1<string, Traversal<LaagModel, FieldSelection>> = fieldName =>
    fieldSelectionsLens.composeTraversal(selectiveArrayTraversal(fs => fs.name === fieldName));
  const fieldSelectionTraversal: Traversal<LaagModel, FieldSelection> = fieldSelectionsLens.composeTraversal(arrayTraversal());

  // Bepaalde velden moeten samengevoegd worden tot 1 synthetisch locatieveld. Daarvoor moeten we enerzijds de headers
  // aanpassen en anderzijds elke Row die binnen komt.
  const locationTransformer: Function1<ke.VeldInfo[], [Endomorphism<FieldSelection[]>, Endomorphism<Velden>]> = veldinfos => {
    // We moeten op label werken, want de gegevens zitten op verschillende plaatsen bij verschillende lagen
    const veldlabels = veldinfos.map(ke.VeldInfo.veldlabelLens.get).filter(label => label !== undefined) as string[];
    const wegLabel = "Ident8";
    const lijnAfstandLabels = ["Van refpunt", "Van afst", "Tot refpunt", "Tot afst"];
    const puntAfstandLabels = ["Refpunt", "Afstand"];
    const maybeWegKey = array.findFirst(veldinfos, vi => vi.label === wegLabel).map(ke.VeldInfo.veldnaamLens.get);
    return maybeWegKey.fold([identity, identity] as [Endomorphism<FieldSelection[]>, Endomorphism<Velden>], wegKey => {
      const distance: Function2<number, number, string> = (ref, offset) => (offset >= 0 ? `${ref} +${offset}` : `${ref} ${offset}`);
      const lijnValueGen = (wegValue: string) => (distances: number[]): string =>
        `${wegValue} van ${distance(distances[0], distances[1])} tot ${distance(distances[2], distances[3])}`;
      const puntValueGen = (wegValue: string) => (distances: number[]): string => `${wegValue} ${distance(distances[0], distances[1])}`;

      const allLijnLabelsPresent = arrays.containsAll(ordString)(veldlabels, lijnAfstandLabels);
      const allPuntLabelsPresent = arrays.containsAll(ordString)(veldlabels, puntAfstandLabels);

      const [locationLabels, locationValueGen]: [string[], Curried2<string, number[], string>] = allLijnLabelsPresent
        ? [lijnAfstandLabels, lijnValueGen]
        : allPuntLabelsPresent
        ? [puntAfstandLabels, puntValueGen]
        : [[], () => () => ""];

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

      const rowTrf: Endomorphism<Velden> = row => {
        const maybeWegValue = row[wegKey];
        const maybeDistances: Option<number[]> = traversable
          .sequence(option.option, array.array)(locationKeys.map(key => row[key].maybeValue.filter(isNumber)))
          .filter(ns => ns.length === locationLabels.length);
        const locatieField: Field = {
          maybeValue: maybeWegValue.maybeValue
            .map(wegValue => maybeDistances.fold(`${wegValue}`, locationValueGen(wegValue.toString())))
            .orElse(() => option.some("<Geen weglocatie>"))
        };
        return Row.addField("syntheticLocation", locatieField)(row);
      };
      return [fieldsSelectionTrf, rowTrf] as [Endomorphism<FieldSelection[]>, Endomorphism<Velden>];
    });
  };

  const formatBoolean: Endomorphism<Field> = field => ({ maybeValue: field.maybeValue.map(value => (value ? "JA" : "NEEN")) });
  const rowFormat: Function1<ke.VeldInfo, Option<Endomorphism<Field>>> = vi =>
    vi.type === "boolean" ? option.some(formatBoolean) : option.none;
  const rowFormatsFromVeldinfos: Function1<ke.VeldInfo[], FieldsFormatSpec> = veldinfos =>
    pipe(
      record.fromFoldableMap(getLastSemigroup<ke.VeldInfo>(), array.array)(veldinfos, vi => [vi.naam, vi]),
      record.filterMap(rowFormat)
    );

  const fieldFormatter: Function2<string[], FieldsFormatSpec, Function2<string, Field, Field>> = (selectedFieldNames, formats) => (
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
  const rowFormatterForFields: Function2<FieldSelection[], FieldsFormatSpec, Endomorphism<Velden>> = (fieldSelections, rowFormats) =>
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
      const [fieldsTransformer, veldenTransformer] = locationTransformer(veldinfos);

      const sortOnFirstField = indexArray<FieldSelection>()
        .index(0)
        .composeLens(FieldSelection.maybeSortDirectionLens)
        .set(option.some("ASCENDING") as Option<SortDirection>);

      const fieldSelections = pipe(
        veldinfos,
        FieldSelection.fieldsFromVeldinfo,
        fieldsTransformer,
        FieldSelection.selectBaseFields,
        sortOnFirstField
      );

      const firstField = array.take(1, fieldSelections);
      const contributingVeldinfos = array.chain(FieldSelection.contributingVeldinfosGetter.get)(firstField);
      const fieldSortings = contributingVeldinfos.map(FieldSorting.create("ASCENDING"));
      const veldenFormats = rowFormatsFromVeldinfos(veldinfos);
      const veldenFormatter = rowFormatterForFields(fieldSelections, veldenFormats);

      return {
        titel: laag.titel,
        veldinfos,
        hasFilter: Filter.isDefined(laag.filterinstellingen.spec),
        filterIsActive: laag.filterinstellingen.actief,
        viewSourceMode: "Map" as ViewSourceMode,
        selectionViewMode: "SourceFeatures" as SelectionViewMode,
        totaal: laag.filterinstellingen.totaal,
        canUseAllFeatures: false,
        featureCount: FeatureCount.pending,
        fullFeatureCount: FeatureCount.pending,
        expectedPageNumber: Page.first,
        fieldSelections,
        fieldSortings,
        fieldFormats: veldenFormats,
        veldenFormatter: veldenFormatter,
        source,
        minZoom: laag.bron.minZoom,
        maxZoom: laag.bron.maxZoom,
        page: option.none,
        nextPageSequence: 0,
        updatePending: true,
        viewinstellingen,
        veldenTransformer: veldenTransformer,
        visibleFeatures: [],
        selectedFeatures: []
      };
    });

  const isExpectedPageSequence: Function1<number, Predicate<LaagModel>> = sequenceNumber => laag =>
    laag.nextPageSequence === sequenceNumber;

  const ifIsExpectedPageSequence = (expectedPageSequence: number) => (f: Endomorphism<LaagModel>): Endomorphism<LaagModel> => laag =>
    isExpectedPageSequence(expectedPageSequence)(laag) ? f(laag) : laag;

  const incrementNextPageSequence = nextPageSequenceLens.modify(n => n + 1);

  export const isOnFirstPage: Predicate<LaagModel> = laag => laag.page.map(Page.pageNumberLens.get).exists(Page.isFirst);
  export const isOnLastPage: Predicate<LaagModel> = laag =>
    FeatureCount.fetchedCount(laag.featureCount).fold(
      true, //
      featureCount => laag.page.map(Page.pageNumberLens.get).exists(Page.isTop(Page.last(featureCount)))
    );
  export const hasMultiplePages: Predicate<LaagModel> = laag =>
    FeatureCount.fetchedCount(laag.featureCount).fold(false, featureCount => !Page.isFirst(Page.last(featureCount)));

  const applyIfOrElse = (pred: Predicate<LaagModel>) => (
    ifTrue: Endomorphism<LaagModel>,
    ifFalse: Endomorphism<LaagModel>
  ): Endomorphism<LaagModel> => laag => (pred(laag) ? ifTrue(laag) : ifFalse(laag));
  const applyIf = (pred: Predicate<LaagModel>) => (ifTrue: Endomorphism<LaagModel>): Endomorphism<LaagModel> =>
    applyIfOrElse(pred)(ifTrue, identity);

  const ifInMapAsFilter = flow(
    viewSourceModeGetter.get,
    equalToString("Map")
  );
  const updateIfMapAsFilterOrElse = Update.ifOrElse(ifInMapAsFilter);
  const applyIfMapAsFilter: Endomorphism<Endomorphism<LaagModel>> = applyIf(ifInMapAsFilter);

  const ifShowAllFeatures = flow(
    selectionViewModeGetter.get,
    equalToString("SourceFeatures")
  );
  const ifShowSelectedOnly = (laag: LaagModel) => !ifShowAllFeatures(laag);
  const updateIfShowAllFeaturesOrElse = Update.ifOrElse(ifShowAllFeatures);

  const ifInZoom = (laag: LaagModel) => laag.viewinstellingen.zoom >= laag.minZoom && laag.viewinstellingen.zoom <= laag.maxZoom;
  const updateIfInZoom = Update.filter(ifInZoom);
  const applyIfInZoomOrElse = (
    endoInZoom: Endomorphism<LaagModel>,
    endoOutsideZoom: Endomorphism<LaagModel>
  ): Endomorphism<LaagModel> => laag => (ifInZoom(laag) ? endoInZoom : endoOutsideZoom)(laag);

  const toggleSortDirection: Endomorphism<Option<SortDirection>> = flow(
    option.map(SortDirection.invert),
    option.alt(() => option.some("ASCENDING" as SortDirection))
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

  const laagPageRequest: Function1<LaagModel, PageRequest> = laag => ({
    dataExtent: laag.viewinstellingen.extent,
    fieldSortings: laag.fieldSortings,
    pageNumber: laag.expectedPageNumber,
    rowCreator: maakRow(laag),
    requestSequence: laag.nextPageSequence
  });

  const maakRow: Curried2<LaagModel, ol.Feature, Option<Row>> = laag => feature => {
    return pipe(
      Feature.featureWithIdAndLaagnaam(feature),
      option.map(featureWithIdAndLaagnaam => {
        const origVelden = Row.featureToVelden(laag.veldinfos)(featureWithIdAndLaagnaam);

        const velden = flow(
          laag.veldenTransformer,
          laag.veldenFormatter
        )(origVelden);

        return {
          feature: featureWithIdAndLaagnaam,
          velden: velden
        };
      })
    );
  };

  const withFullExtent: Endomorphism<PageRequest> = pageRequest => ({
    ...pageRequest,
    dataExtent: [18000.0, 152999.75, 280144.0, 415143.75]
  });

  const updateLaagPage: Function1<Page, Endomorphism<LaagModel>> = page =>
    flow(
      laag => pageLens.set(ifInZoom(laag) || !ifInMapAsFilter(laag) ? option.some(page) : option.none)(laag),
      expectedPageNumberLens.set(page.pageNumber) // Het kan gebeuren dat er minder paginas zijn dan we vroegen
    );

  const modifySourceLaagFeatureCount: LaagModelSyncUpdate = applyIfMapAsFilter(laag =>
    featureCountLens.set(FeatureCountFetcher.countFromSource(laag.source, { dataExtent: laag.viewinstellingen.extent }))(laag)
  );

  // Pas de huidige Page aan indien de kaart als filter gebruikt wordt.
  const updateLaagPageDataFromVisible: LaagModelUpdate = Update.createSync(laag =>
    flow(
      pipe(
        laag,
        laagPageRequest,
        PageFetcher.pageFromAllFeatures(laag.visibleFeatures),
        updateLaagPage
      ),
      incrementNextPageSequence, // voorkom dat vroegere update deze overschrijft
      modifySourceLaagFeatureCount, // tel features na zoom, pan, etc.
      updatePendingLens.set(false)
    )(laag)
  );

  // Pas de huidige Page aan met geselecteerde features indien de kaart als filter gebruikt wordt. Andere functie nodig
  // dan zonder selectie omdat dit op het niveau van de source niet geweten is.
  const updateLaagPageDataFromSelected: LaagModelUpdate = Update.createSync(laag =>
    flow(
      pipe(
        laag,
        laagPageRequest,
        PageFetcher.pageFromSelected(laag.selectedFeatures),
        updateLaagPage
      ),
      incrementNextPageSequence, // voorkom dat vroegere update deze overschrijft
      updatePendingLens.set(false)
    )(laag)
  );

  // Pas de huidige Page aan met geselecteerde features indien de kaart niet als filter gebruikt wordt, maar we toch aan
  // de source kunnen refereren omdat we alleen geselecteerde features willen kennen en die altijd op de source aanwezig
  // zijn.
  const updateLaagPageDataFromSelectedFullExtent: LaagModelUpdate = Update.createSync(laag =>
    flow(
      pipe(
        laag,
        laagPageRequest,
        withFullExtent,
        PageFetcher.pageFromSelected(laag.selectedFeatures),
        updateLaagPage
      ),
      incrementNextPageSequence, // voorkom dat vroegere update deze overschrijft
      updatePendingLens.set(false)
    )(laag)
  );

  // Pas uiteindelijk de huidige Page aan indien de volledige data gebruikt wordt.
  const updateLaagPageDataFromServer: LaagModelUpdate = Update.create(
    flow(
      updatePendingLens.set(true),
      incrementNextPageSequence
    )
  )((laag: LaagModel) =>
    PageFetcher.pageFromServer(laag.titel, laag.source, laagPageRequest(laag)).pipe(
      map(
        DataRequest.match({
          RequestingData: () => updatePendingLens.set(true),
          DataReady: (dataready: DataReady) =>
            ifIsExpectedPageSequence(dataready.pageSequence)(
              flow(
                featureCountLens.set(dataready.featureCount),
                updateLaagPage(dataready.page),
                updatePendingLens.set(false)
              )
            ),
          RequestFailed: () =>
            flow(
              updatePendingLens.set(false),
              laag =>
                pipe(
                  laag.page,
                  option.fold(() => Page.first, Page.pageNumberLens.get),
                  expectedPageNumberLens.set // expected is gelijk aan wat in de page zit
                  // We kunnen hier ook de tabel leeg maken of een error icoontje oid tonen
                )(laag)
            )
        })
      )
    )
  );

  // Enkel een page opvragen en in het model steken
  const updateLaagPageData: LaagModelUpdate = updateIfMapAsFilterOrElse(
    updateIfInZoom(updateIfShowAllFeaturesOrElse(updateLaagPageDataFromVisible, updateLaagPageDataFromSelected)),
    updateIfShowAllFeaturesOrElse(updateLaagPageDataFromServer, updateLaagPageDataFromSelectedFullExtent)
  );

  // Deze functie zal in het model voor de laag met de gegeven titel eerst de functie f uitvoeren (initiële
  // transformaties) en daarna zorgen dat de Page aangepast wordt. Op zich is dit niet meer dan 2 Updates na elkaar
  // uitvoeren, maar we willen de boilerplate voor de lifting en de concattenatie concenteren op 1 plaats.
  const andThenUpdatePageData: Function1<Endomorphism<LaagModel>, LaagModelUpdate> = f =>
    Update.combineAll(Update.createSync(f), updateLaagPageData);

  // Maakt een (Sync)Update van het endomorfisme en ververst daarna conditioneel de page
  const andThenUpdatePageDataIf: Curried2<Predicate<LaagModel>, Endomorphism<LaagModel>, LaagModelUpdate> = pred => f =>
    Update.combineAll(Update.createSync(f), Update.filter(pred)(updateLaagPageData));

  // Leest beter in traditionele functieaanroepstijl
  const updatePageDataAfter = andThenUpdatePageData;

  const clearLaagPage: Endomorphism<LaagModel> = pageLens.set(option.none);

  // TODO: Aangeroepen wanneer viewInstelling veranderen. Dit gebeurt heel kort voor of na het zetten van visibleFeatures. De
  // page update zal dus ook 2x kort na elkaar uitgevoerd worden. We kunnen dit oplossen door een combineLatest +
  // debounceTime waar de udpates aangemaakt worden.
  export const setViewInstellingen: Function1<Viewinstellingen, LaagModelUpdate> = vi =>
    pipe(
      flow(
        viewinstellingenLens.set(vi),
        applyIfMapAsFilter(
          applyIfInZoomOrElse(
            identity,
            flow(
              clearLaagPage,
              clearLaagFeatureCount
            )
          )
        )
      ),
      andThenUpdatePageDataIf(ifInMapAsFilter)
    );

  // TODO: misschien beter specifiek type voor buiten zoom
  const clearLaagFeatureCount: Endomorphism<LaagModel> = featureCountLens.set(FeatureCount.createFetched(0));

  const noSelectedFeatures = (laag: LaagModel): boolean => arrays.isEmpty(laag.selectedFeatures);

  const getOutOfSelectedOnlyModeIfNoFeaturesSelected: LaagModelUpdate = pipe(
    laag =>
      noSelectedFeatures(laag)
        ? flow(
            unsafeSelectionViewModeLens.set("SourceFeatures"),
            updatePendingLens.set(true) // kleine hack om page update enkel te triggeren indien mode switch
          )(laag)
        : laag,
    andThenUpdatePageDataIf(updatePendingLens.get)
  );

  const totaalUpdate: Function1<FilterTotaal, Endomorphism<LaagModel>> = FilterTotaalMatch({
    TotaalOpTeHalen: () =>
      flow(
        // fullFeatureCountLens.set(FeatureCount.pending),
        canUseAllFeaturesLens.set(false)
      ),
    TeVeelData: () =>
      flow(
        // fullFeatureCountLens.set(FeatureCount.failed), // we zouden ander type kunnen gebruiken, maar is toch nooit zichtbaar
        canUseAllFeaturesLens.set(false)
      ),
    TotaalOpgehaald: () =>
      flow(
        // fullFeatureCountLens.set(FeatureCount.createFetched(opgehaald.totaal)), // dus afhankelijk van filter
        canUseAllFeaturesLens.set(true)
      ),
    TotaalOphalenMislukt: () =>
      flow(
        // fullFeatureCountLens.set(FeatureCount.failed),
        canUseAllFeaturesLens.set(false)
      )
  });

  export const getTotalFeaturesUpdate: LaagModelUpdate = Update.createAsync<LaagModel>(laag => {
    return subSpy("****fetchTotal$")(laag.source.fetchTotal$()).pipe(map(totaalUpdate));
  }) as LaagModelUpdate;

  const clampExpectedPageNumber: Endomorphism<LaagModel> = laag =>
    expectedPageNumberLens.modify(
      ord.clamp(Page.ordPageNumber)(Page.first, Page.last(FeatureCount.fetchedCount(laag.featureCount).getOrElse(0)))
    )(laag);

  const modifyPageNumberUpdate: Function1<Endomorphism<PageNumber>, LaagModelUpdate> = pageNumberUpdate =>
    updatePageDataAfter(
      flow(
        expectedPageNumberLens.modify(pageNumberUpdate),
        clampExpectedPageNumber,
        incrementNextPageSequence,
        updatePendingLens.set(true)
      )
    );

  export const previousPageUpdate: LaagModelUpdate = modifyPageNumberUpdate(Page.previous);

  export const nextPageUpdate: LaagModelUpdate = modifyPageNumberUpdate(Page.next);

  export const setPageNumberUpdate: Function1<number, LaagModelUpdate> = pageNr => modifyPageNumberUpdate(Page.set(pageNr));

  export const chooseBaseFieldsUpdate: LaagModelUpdate = updatePageDataAfter(fieldSelectionsLens.modify(FieldSelection.selectBaseFields));

  export const chooseAllFieldsUpdate: LaagModelUpdate = updatePageDataAfter(fieldSelectionsLens.modify(FieldSelection.selectAllFields));

  export const setFieldSelectedUpdate: Function2<string, boolean, LaagModelUpdate> = (fieldName, value) =>
    updatePageDataAfter(
      fieldSelectionForNameTraversal(fieldName)
        .composeLens(FieldSelection.selectedLens)
        .set(value)
    );

  export const sortFieldToggleUpdate: Function1<string, LaagModelUpdate> = flow(
    toggleSortingField,
    andThenUpdatePageData
  );

  export const setMapAsFilterUpdate: Function1<boolean, LaagModelUpdate> = flow(
    setting => (setting ? "Map" : "AllFeatures"),
    viewSourceMode =>
      pipe(
        flow(
          expectedPageNumberLens.set(Page.first),
          clearLaagPage,
          unsafeViewSourceModeLens.set(viewSourceMode)
        ),
        andThenUpdatePageData
      )
  );

  export const setShowSelectedOnlyUpdate: Function1<boolean, LaagModelUpdate> = flow(
    setting => (setting ? "SelectedOnly" : "SourceFeatures"),
    viewSelectionMode =>
      pipe(
        flow(
          expectedPageNumberLens.set(Page.first),
          clearLaagPage,
          unsafeSelectionViewModeLens.set(viewSelectionMode)
        ),
        andThenUpdatePageData
      )
  );

  export const updateVisibleFeatures: Function1<ol.Feature[], LaagModelUpdate> = features =>
    pipe(
      features,
      visibleFeaturesLens.set,
      andThenUpdatePageDataIf(ifInMapAsFilter)
    );

  export const updateSelectedFeatures: Function1<ol.Feature[], LaagModelUpdate> = featuresOpLaag =>
    Update.combineAll(
      pipe(
        selectedFeaturesLens.set(featuresOpLaag),
        andThenUpdatePageDataIf(ifShowSelectedOnly)
      ),
      getOutOfSelectedOnlyModeIfNoFeaturesSelected
    );
}
