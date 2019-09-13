import { array, option, ord, setoid, traversable } from "fp-ts";
import { constant, Curried2, curry, Endomorphism, flip, flow, Function1, Function2, identity, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Setoid } from "fp-ts/lib/Setoid";
import { fromTraversable, Lens, Optional, Prism, Traversal } from "monocle-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map } from "rxjs/operators";
import { isNumber } from "util";

import { Filter } from "../../filter";
import { NosqlFsSource } from "../../source";
import { applySequential, PartialFunction2 } from "../../util/function";
import { selectiveArrayTraversal } from "../../util/lenses";
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

// Deze interface verzamelt de gegevens die we nodig hebben om 1 laag weer te geven in de tabelview. Het is
// tegelijkertijd een abstractie van het onderliggende model + state nodig voor de tabel use cases (MVP).
export interface LaagModel {
  readonly titel: string;
  readonly veldinfos: ke.VeldInfo[]; // enkel de VeldInfos die we kunnen weergeven
  readonly hasFilter: boolean;
  readonly filterIsActive: boolean;
  readonly featureCount: FeatureCount; // aantal features in de tabel over alle pagina's heen
  readonly expectedPageNumber: PageNumber; // Het PageNumber dat we verwachten te zien. Potentieel anders dan in Page wegens asynchoniciteit
  readonly page: Option<Page>; // We houden maar 1 pagina van data tegelijkertijd in het geheugen. (later meer)

  readonly headers: ColumnHeaders;
  readonly selectedVeldnamen: string[]; // enkel een subset van de velden is zichtbaar
  readonly fieldSortings: FieldSorting[];
  readonly rowTransformer: Endomorphism<Row>; // bewerkt de ruwe rij (bijv. locatieveld toevoegen)

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
  // readonly ord: Ord<ol.Feature>;
  // readonly viewAsFilter: boolean;
}

export interface ColumnHeaders {
  readonly headers: ColumnHeader[];
  readonly columnWidths: string; // we willen dit niet in de template opbouwen
}

// De titel van een kolom. Wordt ook gebruikt om een Feature om te zetten naar een Row.
export interface ColumnHeader {
  readonly key: string; // om op te zoeken in een row
  readonly label: string; // voor weergave
  readonly contributingVeldinfos: ke.VeldInfo[]; // support voor sortering: alle velden die bijdragen tot de kolom
}

// De titel van een laag + geassocieerde state
export interface TableHeader {
  readonly titel: string;
  readonly filterIsActive: boolean;
  readonly hasFilter: boolean;
  readonly count: number | undefined;
}

namespace ColumnHeader {
  export const setoidColumnHeader: Setoid<ColumnHeader> = setoid.getStructSetoid({
    key: setoid.setoidString,
    label: setoid.setoidString
  });

  export const setoidColumnHeaderByKey: Setoid<ColumnHeader> = setoid.contramap(ch => ch.key, setoid.setoidString);
}

export namespace ColumnHeaders {
  export const create: Function1<ColumnHeader[], ColumnHeaders> = headers => ({
    headers,
    columnWidths: headers.map(_ => "minmax(150px, 1fr)").join(" ")
  });

  export const setoidColumnHeaders: Setoid<ColumnHeaders> = setoid.contramap(
    ch => ch.headers,
    array.getSetoid(ColumnHeader.setoidColumnHeaderByKey)
  );
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
    count: setoid.setoidNumber // TODO controleer undefined
  });
}

export namespace LaagModel {
  export const titelLens: Lens<LaagModel, string> = Lens.fromProp<LaagModel>()("titel");
  export const pageOptional: Optional<LaagModel, Page> = Optional.fromOptionProp<LaagModel>()("page");
  export const headersLens: Lens<LaagModel, ColumnHeaders> = Lens.fromProp<LaagModel, "headers">("headers");
  export const expectedPageNumberLens: Lens<LaagModel, PageNumber> = Lens.fromProp<LaagModel>()("expectedPageNumber");
  export const pageLens: Lens<LaagModel, Option<Page>> = Lens.fromProp<LaagModel>()("page");
  export const nextPageSequenceLens: Lens<LaagModel, number> = Lens.fromProp<LaagModel>()("nextPageSequence");
  export const updatePendingLens: Lens<LaagModel, boolean> = Lens.fromProp<LaagModel>()("updatePending");
  export const aantalFeaturesLens: Lens<LaagModel, FeatureCount> = Lens.fromProp<LaagModel>()("featureCount");
  export const viewinstellingLens: Lens<LaagModel, Viewinstellingen> = Lens.fromProp<LaagModel>()("viewinstellingen");
  export const zoomLens: Lens<LaagModel, number> = Lens.fromPath<LaagModel>()(["viewinstellingen", "zoom"]);
  export const extentLens: Lens<LaagModel, ol.Extent> = Lens.fromPath<LaagModel>()(["viewinstellingen", "extent"]);
  export const hasFilterLens: Lens<LaagModel, boolean> = Lens.fromProp<LaagModel>()("hasFilter");
  export const filterIsActiveLens: Lens<LaagModel, boolean> = Lens.fromProp<LaagModel>()("filterIsActive");

  export const clampExpectedPageNumber: Endomorphism<LaagModel> = laag =>
    expectedPageNumberLens.modify(
      ord.clamp(Page.ordPageNumber)(Page.first, Page.last(FeatureCount.fetchedCount(laag.featureCount).getOrElse(0)))
    )(laag);

  // Bepaalde velden moeten samengevoegd worden tot 1 synthetisch locatieveld. Daarvoor moeten we enerzijds de headers
  // aanpassen en anderzijds elke Row die binnen komt.
  const locationTransformer: Function1<ke.VeldInfo[], [Endomorphism<ColumnHeader[]>, Endomorphism<Row>]> = veldinfos => {
    // We moeten op label werken, want de gegevens zitten op verschillende plaatsen bij verschillende lagen
    const veldlabels = veldinfos.map(ke.VeldInfo.veldlabelLens.get);
    const wegLabel = "Ident8";
    const afstandLabels = ["Van refpunt", "Van afst", "Tot refpunt", "Tot afst"];
    const maybeWegKey = array.findFirst(veldinfos, vi => vi.label === wegLabel).map(ke.VeldInfo.veldnaamLens.get);
    return maybeWegKey.fold([identity, identity] as [Endomorphism<ColumnHeader[]>, Endomorphism<Row>], wegKey => {
      const allLabelsPresent = afstandLabels.filter(label => veldlabels.includes(label)).length === afstandLabels.length; // alles of niks!
      const locationLabels = allLabelsPresent ? afstandLabels : [];

      const locationKeys = array.array.filterMap(locationLabels, label =>
        array.findFirst(veldinfos, vi => vi.label === label).map(ke.VeldInfo.veldnaamLens.get)
      );

      const allLocationLabels = array.cons(wegLabel, locationLabels);
      const allLocationKeys = array.cons(wegKey, locationKeys);
      const allLocationVeldinfos = array.filterMap(key => array.findFirst<ke.VeldInfo>(vi => vi.naam === key)(veldinfos))(allLocationKeys);
      const locationHeader: ColumnHeader = { key: "syntheticLocation", label: "Locatie", contributingVeldinfos: allLocationVeldinfos };
      const headersTrf: Endomorphism<ColumnHeader[]> = headers =>
        array
          .cons(locationHeader, headers) // De synthetische header toevoegen
          .filter(header => !allLocationLabels.includes(header.label)); // en de bijdragende headers verwijderen

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
          label: option.fromNullable(vi.label).getOrElse(vi.naam),
          contributingVeldinfos: [vi]
        }));
      const [headersTransformer, rowTransformer] = locationTransformer(veldinfos);
      const headers = ColumnHeaders.create(headersTransformer(baseColumnHeaders));

      const pageFetcher = PageFetcher.sourceBasedPageFetcher(laag.bron.source);
      const featureCountFetcher = FeatureCountFetcher.sourceBasedFeatureCountFetcher(laag.bron.source);

      const firstHeader = array.take(1, headers.headers);
      const contributingVeldinfos = array.chain((header: ColumnHeader) => header.contributingVeldinfos)(firstHeader);
      const fieldSortings = contributingVeldinfos.map(vi => ({
        fieldKey: vi.naam,
        direction: "ASCENDING" as SortDirection,
        veldinfo: vi
      }));

      return {
        titel: laag.titel,
        veldinfos,
        hasFilter: Filter.isDefined(laag.filterinstellingen.spec),
        filterIsActive: laag.filterinstellingen.actief,
        totaal: laag.filterinstellingen.totaal,
        featureCount: FeatureCount.pending,
        expectedPageNumber: Page.first,
        selectedVeldnamen,
        headers,
        fieldSortings,
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

  export const headersForTitel: Curried2<string, TableModel, Option<ColumnHeaders>> = titel => {
    // return laagForTitelTraversal(titel)
    //   .composeLens(headersLens)
    //   .asFold().headOption;
    return model => array.findFirst(laagDataLens.get(model), laag => laag.titel === titel).map(LaagModel.headersLens.get);
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
            laag.rowTransformer
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

  export const featuresUpdate: Function1<ke.ToegevoegdeVectorLaag, Update> = tvlg =>
    syncUpdateOnly(
      laagForTitelTraversal(tvlg.titel).modify(
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
      )
    );

  export const followViewFeatureUpdates: Function1<ke.ToegevoegdeVectorLaag, rx.Observable<Update>> = tvlg =>
    ke.ToegevoegdeVectorLaag.featuresChanged$(tvlg).pipe(map(() => featuresUpdate(tvlg)));

  const modifyPageNumberUpdate: Curried2<Endomorphism<PageNumber>, string, Update> = f => titel =>
    syncUpdateOnly(
      laagForTitelTraversal(titel).modify(
        flow(
          LaagModel.expectedPageNumberLens.modify(f),
          LaagModel.clampExpectedPageNumber,
          updateLaagPageData
        )
      )
    );

  export const previousPageUpdate: Function1<string, Update> = modifyPageNumberUpdate(Page.previous);

  export const nextPageUpdate: Function1<string, Update> = modifyPageNumberUpdate(Page.next);

  export const setPageNumberUpdate: Curried2<string, number, Update> = titel => pageNr => modifyPageNumberUpdate(Page.set(pageNr))(titel);
}
