import { array, option } from "fp-ts";
import { Endomorphism, flow, Predicate } from "fp-ts/lib/function";
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

  export const empty: (
    viewinstellingen: Viewinstellingen,
    config: KaartConfig
  ) => TableModel = (viewinstellingen, config) => ({
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

  const laagForTitelTraversal: (
    arg: string
  ) => Traversal<TableModel, LaagModel> = (titel) =>
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

  export const laagForTitelOnLaagData: (
    arg1: string
  ) => (arg2: LaagModel[]) => option.Option<LaagModel> = (titel) => (
    laagData
  ) => array.findFirst<LaagModel>((laag) => laag.titel === titel)(laagData);

  export const laagForTitel: (
    arg1: string
  ) => (arg2: TableModel) => option.Option<LaagModel> = (titel) => (model) => {
    // asFold geeft een bug: Zie https://github.com/gcanti/monocle-ts/issues/96
    // return laagForTitelTraversal(titel).asFold().headOption;
    return laagForTitelOnLaagData(titel)(model.laagData);
  };

  // We willen hier niet de state voor alle lagen opnieuw initialiseren. We moeten enkel de nieuwe lagen toevoegen en de
  // oude verwijderen. Van de bestaande moeten we de state aanpassen indien nodig.
  export const updateLagen: (
    arg: ke.ToegevoegdeVectorLaag[]
  ) => TableModelUpdate = (lagen) => {
    return Update.createSync<TableModel>((model) =>
      laagDataLens.modify((laagData) =>
        pipe(
          lagen,
          array.filterMap((laag) =>
            pipe(
              laagForTitelOnLaagData(laag.titel)(laagData), // kennen we die laag al?
              option.alt(() => LaagModel.create(laag, model.viewinstellingen)) // indien niet, creëer er een nieuw model voor
            )
          )
        )
      )(model)
    );
  };

  export const liftLaagUpdate: (
    arg1: string
  ) => (arg2: LaagModel.LaagModelUpdate) => TableModelUpdate = (titel) =>
    Update.liftUpdate(laagForTitel(titel), (f) =>
      laagForTitelTraversal(titel).modify(f)
    );

  const liftSyncLaagUpdateForAllLagenByTitle: (
    arg: (arg: string) => LaagModel.LaagModelSyncUpdate
  ) => TableModelSyncUpdate = (flmsu) =>
    allLagenTraversal.modify((laag) => flmsu(laag.titel)(laag));

  const liftAsyncLaagUpdateForAllLagenByTitle: (
    arg: (arg: string) => LaagModel.LaagModelAsyncUpdate
  ) => TableModelAsyncUpdate = (flmau) => (table) =>
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
  const liftLaagUpdateForAllLagenByTitle: (
    arg: (arg: string) => LaagModel.LaagModelUpdate
  ) => TableModelUpdate = (flmu) =>
    Update.create(
      liftSyncLaagUpdateForAllLagenByTitle((title) => flmu(title).syncUpdate)
    )(
      liftAsyncLaagUpdateForAllLagenByTitle((title) => flmu(title).asyncUpdate)
    );

  // Pas de gegeven LaagModelUpdate toe op alle lagen
  const liftLaagUpdateForAllLagen: (
    arg: LaagModel.LaagModelUpdate
  ) => TableModelUpdate = (lmu) => liftLaagUpdateForAllLagenByTitle(() => lmu);

  const updateByTitle = <A>(
    featuresPerLaag: ReadonlyMap<string, A>,
    updater: (arg: A) => Update<LaagModel>
  ) => (title: string): Update<LaagModel> =>
    pipe(
      option.fromNullable(featuresPerLaag.get(title)),
      option.fold(() => Update.mempty, updater)
    );

  export const updateZoomAndExtent: (
    arg: Viewinstellingen
  ) => TableModelUpdate = (vi) =>
    Update.combineAll(
      Update.createSync(viewinstellingLens.set(vi)),
      liftLaagUpdateForAllLagen(LaagModel.setViewInstellingen(vi))
    );

  export const updateZichtbareFeatures: (
    featuresByTitle: ReadonlyMap<string, ol.Feature[]>
  ) => TableModelUpdate = (featuresByTitle) =>
    liftLaagUpdateForAllLagenByTitle(
      updateByTitle(featuresByTitle, LaagModel.updateVisibleFeatures)
    );

  export const updateSelectedFeatures: (
    arg: GeselecteerdeFeatures
  ) => TableModelUpdate = (features) =>
    liftLaagUpdateForAllLagenByTitle(
      updateByTitle(
        features.featuresPerLaag,
        flow(featuresOpIdToArray, LaagModel.updateSelectedFeatures)
      )
    );

  export const updateFilterSettings: (
    arg: ke.ToegevoegdeVectorLaag
  ) => TableModelUpdate = (tvlg) =>
    liftLaagUpdate(tvlg.titel)(LaagModel.updateFilter(tvlg.filterinstellingen));

  export const setCompactLayout: TableModelUpdate = Update.createSync(
    layoutInstellingLens.set("Compact")
  );
  export const setComfortableLayout: TableModelUpdate = Update.createSync(
    layoutInstellingLens.set("Comfortable")
  );

  export const updateLaagInstellingen: (
    arg: Laagtabelinstellingen
  ) => TableModelUpdate = (lti) =>
    liftLaagUpdate(lti.laagnaam)(
      LaagModel.updateSelectedFieldsAndSortings(
        lti.zichtbareVelden,
        pipe(lti.veldsorteringen, array.head)
      )
    );
}
