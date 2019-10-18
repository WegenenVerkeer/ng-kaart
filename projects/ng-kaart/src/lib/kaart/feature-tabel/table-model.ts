import { array, option } from "fp-ts";
import { Curried2, Endomorphism, flow, Function1, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { fromTraversable, Lens, Traversal } from "monocle-ts";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import { Filter } from "../../filter";
import * as arrays from "../../util/arrays";
import { selectiveArrayTraversal } from "../../util/lenses";
import * as ke from "../kaart-elementen";
import { GeselecteerdeFeatures, Viewinstellingen } from "../kaart-protocol-subscriptions";
import { featuresOpIdToArray } from "../model-changes";

import { Page } from "./data-provider";
import { LaagModel } from "./laag-model";
import { AsyncUpdate, SyncUpdate, Update } from "./update";

export interface TableModel {
  readonly laagData: LaagModel[];

  // andere globale eigenschappen
  readonly viewinstellingen: Viewinstellingen;
}

export namespace TableModel {
  export type TableModelSyncUpdate = SyncUpdate<TableModel>;
  export type TableModelAsyncUpdate = AsyncUpdate<TableModel>;
  export type TableModelUpdate = Update<TableModel>;

  export const empty: Function1<Viewinstellingen, TableModel> = viewinstellingen => ({
    laagData: [],
    viewinstellingen
  });

  const laagDataLens: Lens<TableModel, LaagModel[]> = Lens.fromProp<TableModel>()("laagData");
  const viewinstellingLens: Lens<TableModel, Viewinstellingen> = Lens.fromProp<TableModel>()("viewinstellingen");

  const laagForTitelTraversal: Function1<string, Traversal<TableModel, LaagModel>> = titel =>
    laagDataLens.composeTraversal(selectiveArrayTraversal(tl => tl.titel === titel));

  const allLagenTraversal: Traversal<TableModel, LaagModel> = laagDataLens.composeTraversal(fromTraversable(array.array)<LaagModel>());

  export const hasLagen: Predicate<TableModel> = flow(
    laagDataLens.get,
    arrays.isNonEmpty
  );

  export const laagForTitelOnLaagData: Curried2<string, LaagModel[], Option<LaagModel>> = titel => laagData =>
    array.findFirst(laagData, laag => laag.titel === titel);

  export const laagForTitel: Curried2<string, TableModel, Option<LaagModel>> = titel => model => {
    // asFold geeft een bug: Zie https://github.com/gcanti/monocle-ts/issues/96
    // return laagForTitelTraversal(titel).asFold().headOption;
    return laagForTitelOnLaagData(titel)(model.laagData);
  };

  // We willen hier niet de state voor alle lagen opnieuw initialiseren. We moeten enkel de nieuwe lagen toevoegen en de
  // oude verwijderen. Van de bestaande moeten we de state aanpassen indien nodig.
  export const updateLagen: Function1<ke.ToegevoegdeVectorLaag[], TableModelUpdate> = lagen => {
    const updateFilterInstellingen: Function1<ke.Laagfilterinstellingen, Endomorphism<LaagModel>> = instellingen =>
      flow(
        LaagModel.filterIsActiveLens.set(instellingen.actief),
        LaagModel.hasFilterLens.set(Filter.isDefined(instellingen.spec))
      );

    return Update.createSync<TableModel>(model =>
      laagDataLens.modify(laagData =>
        array.array.filterMap(
          lagen,
          laag =>
            laagForTitelOnLaagData(laag.titel)(laagData) // kennen we die laag al?
              .map(updateFilterInstellingen(laag.filterinstellingen)) // pas ze dan aan
              .orElse(() => LaagModel.create(laag, model.viewinstellingen)) // of creëer er een nieuw model voor
        )
      )(model)
    );
  };

  export const liftLaagUpdate: Curried2<string, LaagModel.LaagModelUpdate, TableModelUpdate> = titel =>
    Update.liftUpdate(laagForTitel(titel), f => laagForTitelTraversal(titel).modify(f));

  const liftSyncLaagUpdateForAllLagenByTitle: Function1<Function1<string, LaagModel.LaagModelSyncUpdate>, TableModelSyncUpdate> = flmsu =>
    allLagenTraversal.modify(laag => flmsu(laag.titel)(laag));

  const liftAsyncLaagUpdateForAllLagenByTitle: Function1<
    Function1<string, LaagModel.LaagModelAsyncUpdate>,
    TableModelAsyncUpdate
  > = flmau => table =>
    rx.merge(
      ...table.laagData.map((laag: LaagModel) =>
        flmau(laag.titel)(laag).pipe(map((f: Endomorphism<LaagModel>) => laagForTitelTraversal(laag.titel).modify(f)))
      )
    );

  // Pas de gegeven LaagModelUpdate geconditioneerd door de laagtitel toe op alle lagen
  const liftLaagUpdateForAllLagenByTitle: Function1<Function1<string, LaagModel.LaagModelUpdate>, TableModelUpdate> = flmu =>
    Update.create(liftSyncLaagUpdateForAllLagenByTitle(title => flmu(title).syncUpdate))(
      liftAsyncLaagUpdateForAllLagenByTitle(title => flmu(title).asyncUpdate)
    );

  // Pas de gegeven LaagModelUpdate toe op alle lagen
  const liftLaagUpdateForAllLagen: Function1<LaagModel.LaagModelUpdate, TableModelUpdate> = lmu =>
    liftLaagUpdateForAllLagenByTitle(() => lmu);

  const updateByTitle = <A>(featuresPerLaag: ReadonlyMap<string, A>, updater: Function1<A, Update<LaagModel>>) => (
    title: string
  ): Update<LaagModel> => option.fromNullable(featuresPerLaag.get(title)).fold(Update.mempty, updater);

  export const updateZoomAndExtent: Function1<Viewinstellingen, TableModelUpdate> = vi =>
    Update.combineAll(Update.createSync(viewinstellingLens.set(vi)), liftLaagUpdateForAllLagen(LaagModel.setViewInstellingen(vi)));

  export const updateZichtbareFeatures: Function1<ReadonlyMap<string, ol.Feature[]>, TableModelUpdate> = featuresByTitle =>
    liftLaagUpdateForAllLagenByTitle(updateByTitle(featuresByTitle, LaagModel.updateVisibleFeatures));

  export const updateSelectedFeatures: Function1<GeselecteerdeFeatures, TableModelUpdate> = features =>
    liftLaagUpdateForAllLagenByTitle(
      updateByTitle(
        features.featuresPerLaag,
        flow(
          featuresOpIdToArray,
          LaagModel.updateSelectedFeatures
        )
      )
    );
}
