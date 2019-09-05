import { ValueType } from "@wegenenverkeer/ng-kaart/lib/stijl";
import { array, option, setoid, traversable } from "fp-ts";
import {
  constant,
  Curried2,
  curry,
  Endomorphism,
  flip,
  flow,
  Function1,
  Function2,
  Function3,
  identity,
  Predicate
} from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Setoid } from "fp-ts/lib/Setoid";
import { DateTime } from "luxon";
import { fromTraversable, Lens, Optional, Prism, Traversal } from "monocle-ts";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { filter, map, switchMap, take } from "rxjs/operators";
import { isNumber } from "util";

import { Filter } from "../../filter";
import { NosqlFsSource } from "../../source";
import * as arrays from "../../util/arrays";
import { parseDate, parseDateTime } from "../../util/date-time";
import { Feature } from "../../util/feature";
import { applySequential, PartialFunction2 } from "../../util/function";
import { selectiveArrayTraversal } from "../../util/lenses";
import * as ke from "../kaart-elementen";
import { Viewinstellingen } from "../kaart-protocol-subscriptions";

import { DataRequest, FeatureCount, FeatureCountFetcher, Field, Page, PageFetcher, PageNumber, Row } from "./data-provider";

// export const tabulerbareLagen$: Function1<ModelChanges, rx.Observable<ke.ToegevoegdeVectorLaag[]>> = changes =>
//   changes.lagenOpGroep["Voorgrond.Hoog"].pipe(map(lgn => lgn.filter(ke.isToegevoegdeVectorLaag)));

// export const laagTitels$: Pipeable<ke.ToegevoegdeVectorLaag[], string[]> = lagen$ => lagen$.pipe(map(lgn => lgn.map(lg => lg.titel)));

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

  readonly headers: ColumnHeaders;
  readonly selectedVeldnamen: string[]; // enkel een subset van de velden is zichtbaar
  readonly rowTransformer: Endomorphism<Row>; // bewerkt de ruwe rij (bijv. locatieveld toevoegen)

  readonly source: NosqlFsSource;
  readonly page: Option<Page>; // We houden maar 1 pagina van data tegelijkertijd in het geheugen. (later meer)
  readonly nextPageSequence: number; // Het sequentienummer dat verwacht is, niet het paginanummer
  readonly updatePending: boolean;
  readonly pageFetcher: PageFetcher;
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

export interface ColumnHeader {
  readonly key: string; // om op te zoeken in een row
  readonly label: string; // voor weergave
}

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
  export const pageLens: Lens<LaagModel, Option<Page>> = Lens.fromProp<LaagModel>()("page");
  export const nextPageSequenceLens: Lens<LaagModel, number> = Lens.fromProp<LaagModel>()("nextPageSequence");
  export const updatePendingLens: Lens<LaagModel, boolean> = Lens.fromProp<LaagModel>()("updatePending");
  export const aantalFeaturesLens: Lens<LaagModel, FeatureCount> = Lens.fromProp<LaagModel>()("featureCount");
  export const viewinstellingLens: Lens<LaagModel, Viewinstellingen> = Lens.fromProp<LaagModel>()("viewinstellingen");
  export const zoomLens: Lens<LaagModel, number> = Lens.fromPath<LaagModel>()(["viewinstellingen", "zoom"]);
  export const extentLens: Lens<LaagModel, ol.Extent> = Lens.fromPath<LaagModel>()(["viewinstellingen", "extent"]);
  export const hasFilterLens: Lens<LaagModel, boolean> = Lens.fromProp<LaagModel>()("hasFilter");
  export const filterIsActiveLens: Lens<LaagModel, boolean> = Lens.fromProp<LaagModel>()("filterIsActive");

  // Bepaalde velden moeten samengevoegd worden tot 1 synthetisch locatieveld. Daarvoor moeten we enerzijds de headers
  // aanpassen en anderzijds elke Row die binnen komt.
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
      const pageFetcher = PageFetcher.sourceBasedPageFetcher(laag.bron.source);
      const featureCountFetcher = FeatureCountFetcher.sourceBasedFeatureCountFetcher(laag.bron.source);
      return {
        titel: laag.titel,
        veldinfos,
        hasFilter: Filter.isDefined(laag.filterinstellingen.spec),
        filterIsActive: laag.filterinstellingen.actief,
        totaal: laag.filterinstellingen.totaal,
        featureCount: FeatureCount.pending,
        selectedVeldnamen,
        headers,
        source,
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

  // Zet de binnenkomende pagina indien diens sequenceNumber hetgene is dat we verwachten
  const pageUpdate: Function2<LaagModel, Page, SyncUpdate> = (laag, page) =>
    laagForTitelTraversal(laag.titel)
      .composePrism(LaagModel.isExpectedPage(laag.nextPageSequence))
      .modify(
        flow(
          LaagModel.pageLens.set(option.some(page)),
          LaagModel.updatePendingLens.set(false),
          LaagModel.nextPageSequenceLens.modify(n => n + 1)
        )
      );

  const featureCountUpdate: Function2<LaagModel, FeatureCount, SyncUpdate> = (laag, count) =>
    laagForTitelTraversal(laag.titel).modify(LaagModel.aantalFeaturesLens.set(count));

  const currentPageNumber: Function1<LaagModel, PageNumber> = laag => laag.page.fold(Page.first, Page.pageNumberLens.get);

  const asyncLaagPageUpdate: Function1<LaagModel, rx.Observable<SyncUpdate>> = laag =>
    laag
      .pageFetcher({
        dataExtent: laag.viewinstellingen.extent,
        fieldSortings: [],
        pageNumber: currentPageNumber(laag),
        rowPostProcessor: laag.rowTransformer,
        rowCreator: Row.featureToRow(laag.veldinfos),
        requestSequence: laag.nextPageSequence
      })
      .pipe(
        filter(DataRequest.isDataReady), // risico om zelfde data 2x op te vragen indien vorige toevoeging nog niet verwerkt
        map(dr => pageUpdate(laag, dr.page))
      );

  const asyncFeatureCountUpdate: Function1<LaagModel, rx.Observable<SyncUpdate>> = laag =>
    laag
      .featureCountFetcher({
        dataExtent: laag.viewinstellingen.extent
      })
      .pipe(map(count => featureCountUpdate(laag, count)));

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
      model =>
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
      model =>
        rx
          .merge
          // ...model.laagData.map(asyncLaagPageUpdate), //
          // ...model.laagData.map(asyncFeatureCountUpdate)
          ()
    );

  const updateLaagPage: Endomorphism<LaagModel> = laag =>
    LaagModel.pageLens.set(
      option.some(
        PageFetcher.pageFromSource(laag.source, {
          dataExtent: laag.viewinstellingen.extent,
          fieldSortings: [],
          pageNumber: currentPageNumber(laag),
          rowCreator: Row.featureToRow(laag.veldinfos),
          rowPostProcessor: laag.rowTransformer,
          requestSequence: laag.nextPageSequence
        })
      )
    )(laag);

  const updateLaagFeatureCount: Endomorphism<LaagModel> = laag =>
    LaagModel.aantalFeaturesLens.set(FeatureCountFetcher.countFromSource(laag.source, { dataExtent: laag.viewinstellingen.extent }))(laag);

  export const featuresUpdate: Function1<ke.ToegevoegdeVectorLaag, Update> = tvlg =>
    syncUpdateOnly(
      laagForTitelTraversal(tvlg.titel).modify(
        flow(
          updateLaagPage,
          updateLaagFeatureCount
        )
      )
    );

  export const followViewFeatureUpdates: Function1<ke.ToegevoegdeVectorLaag, rx.Observable<Update>> = tvlg =>
    ke.ToegevoegdeVectorLaag.featuresChanged$(tvlg).pipe(map(() => featuresUpdate(tvlg)));
}
