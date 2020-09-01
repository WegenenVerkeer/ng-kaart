import { array, option } from "fp-ts";
import {
  Curried2,
  Endomorphism,
  flow,
  Function1,
  Function2,
  Predicate,
} from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { fromTraversable, Getter, Lens, Traversal } from "monocle-ts";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import * as arrays from "../../util/arrays";
import { selectiveArrayTraversal } from "../../util/lenses";
import * as ol from "../../util/openlayers-compat";
import { envParams, KaartConfig } from "../kaart-config";
import * as ke from "../kaart-elementen";
import {
  GeselecteerdeFeatures,
  Laagtabelinstellingen,
  Viewinstellingen,
} from "../kaart-protocol-subscriptions";
import { featuresOpIdToArray } from "../model-changes";

import { LaagModel } from "./laag-model";
import { TableLayoutMode } from "./TableLayoutMode";
import { AsyncUpdate, SyncUpdate, Update } from "./update";

export interface TableModel {
  readonly laagData: LaagModel[];

  // andere globale eigenschappen
  readonly viewinstellingen: Viewinstellingen;
  readonly layout: TableLayoutMode;
}

export namespace TableModel {
  export type TableModelSyncUpdate = SyncUpdate<TableModel>;
  export type TableModelAsyncUpdate = AsyncUpdate<TableModel>;
  export type TableModelUpdate = Update<TableModel>;

  export const empty: Function2<Viewinstellingen, KaartConfig, TableModel> = (
    viewinstellingen,
    config
  ) => ({
    laagData: [],
    viewinstellingen,
    layout:
      envParams(config).initialLayoutMode === 1 ? "Compact" : "Comfortable",
  });

  type TableModelLens<A> = Lens<TableModel, A>;
  type TableModelGetter<A> = Getter<TableModel, A>;
  const tableModelPropLens = Lens.fromProp<TableModel>();

  const laagDataLens: Lens<TableModel, LaagModel[]> = tableModelPropLens(
    "laagData"
  );
  const viewinstellingLens: Lens<
    TableModel,
    Viewinstellingen
  > = tableModelPropLens("viewinstellingen");
  const layoutInstellingLens: TableModelLens<TableLayoutMode> = tableModelPropLens(
    "layout"
  );
  export const layoutInstellingGetter: TableModelGetter<TableLayoutMode> = layoutInstellingLens.asGetter();

  const laagForTitelTraversal: Function1<
    string,
    Traversal<TableModel, LaagModel>
  > = (titel) =>
    laagDataLens.composeTraversal(
      selectiveArrayTraversal((tl) => tl.titel === titel)
    );

  const allLagenTraversal: Traversal<
    TableModel,
    LaagModel
  > = laagDataLens.composeTraversal(fromTraversable(array.array)<LaagModel>());

  export const hasLagen: Predicate<TableModel> = flow(
    laagDataLens.get,
    arrays.isNonEmpty
  );

  export const laagForTitelOnLaagData: Curried2<
    string,
    LaagModel[],
    option.Option<LaagModel>
  > = (titel) => (laagData) =>
    array.findFirst(laagData, (laag) => laag.titel === titel);

  export const laagForTitel: Curried2<
    string,
    TableModel,
    option.Option<LaagModel>
  > = (titel) => (model) => {
    // asFold geeft een bug: Zie https://github.com/gcanti/monocle-ts/issues/96
    // return laagForTitelTraversal(titel).asFold().headOption;
    return laagForTitelOnLaagData(titel)(model.laagData);
  };

  // We willen hier niet de state voor alle lagen opnieuw initialiseren. We moeten enkel de nieuwe lagen toevoegen en de
  // oude verwijderen. Van de bestaande moeten we de state aanpassen indien nodig.
  export const updateLagen: Function1<
    ke.ToegevoegdeVectorLaag[],
    TableModelUpdate
  > = (lagen) => {
    return Update.createSync<TableModel>((model) =>
      laagDataLens.modify((laagData) =>
        pipe(
          lagen,
          array.filterMap(
            (laag) =>
              laagForTitelOnLaagData(laag.titel)(laagData) // kennen we die laag al?
                .orElse(() => LaagModel.create(laag, model.viewinstellingen)) // indien niet, creëer er een nieuw model voor
          )
        )
      )(model)
    );
  };

  export const liftLaagUpdate: Curried2<
    string,
    LaagModel.LaagModelUpdate,
    TableModelUpdate
  > = (titel) =>
    Update.liftUpdate(laagForTitel(titel), (f) =>
      laagForTitelTraversal(titel).modify(f)
    );

  const liftSyncLaagUpdateForAllLagenByTitle: Function1<
    Function1<string, LaagModel.LaagModelSyncUpdate>,
    TableModelSyncUpdate
  > = (flmsu) => allLagenTraversal.modify((laag) => flmsu(laag.titel)(laag));

  const liftAsyncLaagUpdateForAllLagenByTitle: Function1<
    Function1<string, LaagModel.LaagModelAsyncUpdate>,
    TableModelAsyncUpdate
  > = (flmau) => (table) =>
    rx.merge(
      ...table.laagData.map((laag: LaagModel) =>
        flmau(laag.titel)(laag).pipe(
          map((f: Endomorphism<LaagModel>) =>
            laagForTitelTraversal(laag.titel).modify(f)
          )
        )
      )
    );

  // Pas de gegeven LaagModelUpdate geconditioneerd door de laagtitel toe op alle lagen
  const liftLaagUpdateForAllLagenByTitle: Function1<
    Function1<string, LaagModel.LaagModelUpdate>,
    TableModelUpdate
  > = (flmu) =>
    Update.create(
      liftSyncLaagUpdateForAllLagenByTitle((title) => flmu(title).syncUpdate)
    )(
      liftAsyncLaagUpdateForAllLagenByTitle((title) => flmu(title).asyncUpdate)
    );

  // Pas de gegeven LaagModelUpdate toe op alle lagen
  const liftLaagUpdateForAllLagen: Function1<
    LaagModel.LaagModelUpdate,
    TableModelUpdate
  > = (lmu) => liftLaagUpdateForAllLagenByTitle(() => lmu);

  const updateByTitle = <A>(
    featuresPerLaag: ReadonlyMap<string, A>,
    updater: Function1<A, Update<LaagModel>>
  ) => (title: string): Update<LaagModel> =>
    option
      .fromNullable(featuresPerLaag.get(title))
      .fold(Update.mempty, updater);

  export const updateZoomAndExtent: Function1<
    Viewinstellingen,
    TableModelUpdate
  > = (vi) =>
    Update.combineAll(
      Update.createSync(viewinstellingLens.set(vi)),
      liftLaagUpdateForAllLagen(LaagModel.setViewInstellingen(vi))
    );

  export const updateZichtbareFeatures: Function1<
    ReadonlyMap<string, ol.Feature[]>,
    TableModelUpdate
  > = (featuresByTitle) =>
    liftLaagUpdateForAllLagenByTitle(
      updateByTitle(featuresByTitle, LaagModel.updateVisibleFeatures)
    );

  export const updateSelectedFeatures: Function1<
    GeselecteerdeFeatures,
    TableModelUpdate
  > = (features) =>
    liftLaagUpdateForAllLagenByTitle(
      updateByTitle(
        features.featuresPerLaag,
        flow(featuresOpIdToArray, LaagModel.updateSelectedFeatures)
      )
    );

  export const updateFilterSettings: Function1<
    ke.ToegevoegdeVectorLaag,
    TableModelUpdate
  > = (tvlg) =>
    liftLaagUpdate(tvlg.titel)(LaagModel.updateFilter(tvlg.filterinstellingen));

  export const setCompactLayout: TableModelUpdate = Update.createSync(
    layoutInstellingLens.set("Compact")
  );
  export const setComfortableLayout: TableModelUpdate = Update.createSync(
    layoutInstellingLens.set("Comfortable")
  );

  export const updateLaagInstellingen: Function1<
    Laagtabelinstellingen,
    TableModelUpdate
  > = (lti) =>
    liftLaagUpdate(lti.laagnaam)(
      LaagModel.updateSelectedFieldsAndSortings(
        lti.zichtbareVelden,
        pipe(lti.veldsorteringen, array.head)
      )
    );
}
