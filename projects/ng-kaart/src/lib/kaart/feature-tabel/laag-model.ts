import { array, option, ord, record, setoid, traversable } from "fp-ts";
import { Endomorphism, flow, Function1, Function2, identity, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import { getLastSemigroup } from "fp-ts/lib/Semigroup";
import { Getter, Lens, Optional, Prism, Traversal } from "monocle-ts";
import { indexArray } from "monocle-ts/lib/Index/Array";
import { prismNonNegativeInteger } from "newtype-ts/lib/NonNegativeInteger";
import * as ol from "openlayers";
import { debounceTime, map, mapTo } from "rxjs/operators";
import { isNumber } from "util";

import { Filter, FilterTotaal, isTotaalOpgehaald } from "../../filter";
import { NosqlFsSource } from "../../source";
import { subSpy } from "../../util";
import { PartialFunction2 } from "../../util/function";
import { flowSpy } from "../../util/function";
import { arrayTraversal, selectiveArrayTraversal } from "../../util/lenses";
import { observableFromOlEvents } from "../../util/ol-observable";
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
import { Field, Row, RowFormatSpec, RowFormatter } from "./row-model";
import { AsyncUpdate, SyncUpdate, Update } from "./update";

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

  // volgende 3 properties worden voorlopig niet meer gebruikt. Misschien wel weer wanneer volledige dataset ipv view
  // gebruikt wordt.
  readonly nextPageSequence: number; // Het sequentienummer dat verwacht is, niet het paginanummer
  readonly updatePending: boolean;

  readonly viewinstellingen: Viewinstellingen; // Kopie van gegevens in TableModel. Handig om hier te refereren

  // later
  // readonly canRequestFullData: boolean;
  // readonly fetchAllData();  --> of nog beter in losse functie?
  // readonly viewAsFilter: boolean;
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
  export const aantalFeaturesLens: LaagModelLens<FeatureCount> = laagPropLens("featureCount");
  export const viewinstellingenLens: LaagModelLens<Viewinstellingen> = laagPropLens("viewinstellingen");
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

  const fieldSelectionForNameTraversal: Function1<string, Traversal<LaagModel, FieldSelection>> = fieldName =>
    fieldSelectionsLens.composeTraversal(selectiveArrayTraversal(fs => fs.name === fieldName));
  const fieldSelectionTraversal: Traversal<LaagModel, FieldSelection> = fieldSelectionsLens.composeTraversal(arrayTraversal());

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

      const sortOnFirstField = indexArray<FieldSelection>()
        .index(0)
        .composeLens(FieldSelection.maybeSortDirectionLens)
        .set(option.some("ASCENDING") as Option<SortDirection>);

      const makeFieldSelected: Endomorphism<FieldSelection[]> = fields => {
        return laag.tabelLaagInstellingen
          .map(instellingen => {
            return fields.map(field => FieldSelection.selectedLens.set(instellingen.zichtbareVelden.has(field.name))(field));
          })
          .getOrElse(fields);
      };

      const fieldSelections = pipe(
        veldinfos,
        FieldSelection.fieldsFromVeldinfo,
        fieldsTransformer,
        FieldSelection.selectBaseFields,
        sortOnFirstField,
        makeFieldSelected
      );

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
        rowTransformer
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

  const ifInFilter = mapAsFilterGetter.get;
  const updateIfMapAsFilterOrElse = Update.ifOrElse(ifInFilter);
  const updateIfMapAsFilter: Endomorphism<LaagModelUpdate> = Update.ifPredicate(ifInFilter);
  const applyIfMapAsFilter: Endomorphism<Endomorphism<LaagModel>> = (f: Endomorphism<LaagModel>) => laag =>
    ifInFilter(laag) ? f(laag) : laag;
  const ifInZoom = (laag: LaagModel) => laag.viewinstellingen.zoom >= laag.minZoom && laag.viewinstellingen.zoom <= laag.maxZoom;
  const updateIfInZoom = Update.ifPredicate(ifInZoom);
  const applyIfInZoomOrElse = (
    endoInZoom: Endomorphism<LaagModel>,
    endoOutsideZoom: Endomorphism<LaagModel>
  ): Endomorphism<LaagModel> => laag => (ifInZoom(laag) ? endoInZoom : endoOutsideZoom)(laag);

  const toggleSortDirection: Endomorphism<Option<SortDirection>> = flow(
    option.map(SortDirection.invert),
    option.alt(() => option.some("ASCENDING") as Option<SortDirection>)
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

  export const setCanUseAllFeatures: Function1<boolean, Endomorphism<LaagModel>> = canUseAllFeaturesLens.set;

  const laagPageRequest: Function1<LaagModel, PageRequest> = laag => ({
    dataExtent: laag.viewinstellingen.extent,
    fieldSortings: laag.fieldSortings,
    pageNumber: laag.expectedPageNumber,
    rowCreator: flow(
      Row.featureToRow(laag.veldinfos),
      laag.rowTransformer,
      laag.rowFormatter
    ),
    requestSequence: laag.nextPageSequence
  });

  const updateLaagPage: Function1<Page, Endomorphism<LaagModel>> = page => laag =>
    pageLens.set(ifInZoom(laag) ? option.some(page) : option.none)(laag);

  // Pas de huidige Page aan indien de kaart als filter gebruikt wordt. Hoewel de test op "kaart als filter" ook vroeger
  // in de ketting gebeurt, testen we hier opnieuw omdat er een race-conditie kan zijn wanneer er ondertussen geschakeld
  // wordt van mode.
  const modifySyncLaagPageDataFromSource: LaagModelSyncUpdate = applyIfMapAsFilter(laag =>
    updateLaagPage(PageFetcher.pageFromSource(laag.source, laagPageRequest(laag)))(laag)
  );

  const modifySourceLaagFeatureCount: LaagModelSyncUpdate = applyIfMapAsFilter(laag =>
    aantalFeaturesLens.set(FeatureCountFetcher.countFromSource(laag.source, { dataExtent: laag.viewinstellingen.extent }))(laag)
  );

  // Pas de huidige Page aan indien de kaart als filter gebruikt wordt.
  const updateLaagPageDataFromSource: LaagModelUpdate = Update.createSync(
    flow(
      modifySyncLaagPageDataFromSource,
      modifySourceLaagFeatureCount,
      updatePendingLens.set(false)
    )
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
                aantalFeaturesLens.set(dataready.featureCount),
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
                )(laag)
            ) // We kunnen hier ook de tabel leeg maken of een error icoontje oid tonen
        })
      )
    )
  );

  // Enkel een page opvragen en in het model steken
  const updateLaagPageData: LaagModelUpdate = updateIfInZoom(
    updateIfMapAsFilterOrElse(updateLaagPageDataFromSource, updateLaagPageDataFromServer)
  );

  // Deze functie zal in het model voor de laag met de gegeven titel eerst de functie f uitvoeren (initiële
  // transformaties) en daarna zorgen dat de Page aangepast wordt. Op zich is dit niet meer dan 2 Updates na elkaar
  // uitvoeren, maar we willen de boilerplate voor de lifting en de concattenatie concenteren op 1 plaats.
  const andThenUpdatePageData: Function1<Endomorphism<LaagModel>, LaagModelUpdate> = f =>
    Update.combineAll(Update.createSync(f), updateLaagPageData);

  // Leest beter in traditionele functieaanroepstijl
  const updatePageDataAfter = andThenUpdatePageData;

  export const setViewInstellingen: Function1<Viewinstellingen, LaagModelUpdate> = vi =>
    Update.createSync(
      flow(
        viewinstellingenLens.set(vi),
        applyIfMapAsFilter(
          flow(
            clearLaagPage,
            applyIfInZoomOrElse(updatePendingLens.set(true), updatePendingLens.set(false))
          )
        )
      )
    );

  // Zorg ervoor dat het verwachte paginanummer binnen de grenzen van beschikbare paginas ligt
  const clampExpecedLaagPageNumber: Endomorphism<LaagModel> = (laag: LaagModel) =>
    expectedPageNumberLens.modify(
      FeatureCount.fetchedCount(laag.featureCount)
        .chain(prismNonNegativeInteger.getOption)
        .fold(identity, featureCount => ord.clamp(Page.ordPageNumber)(Page.first, Page.asPageNumberFromNumberOfFeatures(featureCount)))
    )(laag);

  const clearLaagPage: Endomorphism<LaagModel> = pageLens.set(option.none);

  // TODO: misschien beter specifiek type voor buiten zoom
  const clearLaagFeatureCount: Endomorphism<LaagModel> = aantalFeaturesLens.set(FeatureCount.createFetched(0));

  const prepareSourceFeaturesUpdate: Endomorphism<LaagModel> = applyIfMapAsFilter(
    applyIfInZoomOrElse(
      flow(
        modifySourceLaagFeatureCount,
        clampExpecedLaagPageNumber
      ),
      flow(
        clearLaagPage,
        clearLaagFeatureCount,
        clampExpecedLaagPageNumber
      )
    )
  );

  // Zal de tabel data aanpassen indien we in "kaart als filter mode zitten"
  export const sourceFeaturesUpdate: LaagModelUpdate = updateIfMapAsFilter(updatePageDataAfter(prepareSourceFeaturesUpdate));

  export const followViewFeatureUpdates: LaagModelUpdate = updateIfMapAsFilter(
    Update.createAsync(laag =>
      observableFromOlEvents(laag.source, "addfeature", "removefeature", "clear")
        .pipe(
          debounceTime(200),
          mapTo(null)
        )
        .pipe(
          map(() =>
            flow(
              prepareSourceFeaturesUpdate,
              modifySyncLaagPageDataFromSource,
              modifySourceLaagFeatureCount
            )
          )
        )
    )
  );

  const totaalUpdate: Function1<FilterTotaal, Endomorphism<LaagModel>> = flow(
    isTotaalOpgehaald, // We gebruiken op deze manier automatisch hetzelfde aantal features als grens als voor filters
    setCanUseAllFeatures
  );

  export const followTotalFeaturesUpdate: LaagModelUpdate = Update.createAsync<LaagModel>(laag => {
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
        nextPageSequenceLens.modify(n => n + 1),
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

  const clearPageIfMapAsFilterChangeUpdate: Function1<boolean, LaagModelUpdate> = newMapAsFilterSetting =>
    Update.createSync(laag =>
      laag.mapAsFilter !== newMapAsFilterSetting
        ? flow(
            expectedPageNumberLens.set(Page.first),
            clearLaagPage
          )(laag)
        : laag
    );

  export const setMapAsFilterUpdate: Function1<boolean, LaagModelUpdate> = newMapAsFilterSetting =>
    Update.combineAll(
      clearPageIfMapAsFilterChangeUpdate(newMapAsFilterSetting),
      pipe(
        newMapAsFilterSetting,
        unsafeMapAsFilterLens.set,
        andThenUpdatePageData
      )
    );
}
