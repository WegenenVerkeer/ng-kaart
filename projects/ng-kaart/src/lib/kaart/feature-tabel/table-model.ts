import { array } from "fp-ts";
import { Curried2, Endomorphism, flow, Function1 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { fromTraversable, Lens, Traversal } from "monocle-ts";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import { Filter } from "../../filter";
import { flowSpy } from "../../util/function";
import { selectiveArrayTraversal } from "../../util/lenses";
import * as ke from "../kaart-elementen";
import { Viewinstellingen } from "../kaart-protocol-subscriptions";

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
  export const updateLagen: Function1<ke.ToegevoegdeVectorLaag[], TableModelUpdate> = lagen => {
    const updateFilterInstellingen: Function1<ke.Laagfilterinstellingen, Endomorphism<LaagModel>> = instellingen =>
      flow(
        LaagModel.filterIsActiveLens.set(instellingen.actief),
        LaagModel.hasFilterLens.set(Filter.isDefined(instellingen.spec))
      );

    return Update.create<TableModel>(model =>
      laagDataLens.modify(laagData =>
        array.array.filterMap(
          lagen,
          laag =>
            laagForTitelOnLaagData(laag.titel)(laagData) // kennen we die laag al?
              .map(updateFilterInstellingen(laag.filterinstellingen)) // pas ze dan aan
              .orElse(() => LaagModel.create(laag, model.viewinstellingen)) // of creeer er een nieuw model voor
        )
      )(model)
    )(() =>
      rx
        .merge
        // ...model.laagData.filter(LaagModel.updatePendingLens.get).map(asyncLaagPageUpdate),
        // ...model.laagData.map(asyncFeatureCountUpdate)
        ()
    );
  };

  export const liftLaagUpdate: Curried2<string, LaagModel.LaagModelUpdate, TableModelUpdate> = titel =>
    Update.liftUpdate(laagForTitel(titel), f => laagForTitelTraversal(titel).modify(f));

  const liftSyncLaagUpdateForAllLagen: Function1<LaagModel.LaagModelSyncUpdate, TableModelSyncUpdate> = lmsu =>
    allLagenTraversal.modify(lmsu);
  const liftAsyncLaagUpdateForAllLagen: Function1<LaagModel.LaagModelAsyncUpdate, TableModelAsyncUpdate> = lmau => table =>
    rx.merge(
      ...table.laagData.map((laag: LaagModel) =>
        lmau(laag).pipe(map((f: Endomorphism<LaagModel>) => laagForTitelTraversal(laag.titel).modify(f)))
      )
    );

  // Pas de gegeven LaagModelUpdate toe op alle lagen
  const liftLaagUpdateForAllLagen: Function1<LaagModel.LaagModelUpdate, TableModelUpdate> = lmu =>
    Update.create(liftSyncLaagUpdateForAllLagen(lmu.syncUpdate))(liftAsyncLaagUpdateForAllLagen(lmu.asyncUpdate));

  export const updateZoomAndExtent: Function1<Viewinstellingen, TableModelUpdate> = vi =>
    Update.combineAll(Update.createSync(viewinstellingLens.set(vi)), liftLaagUpdateForAllLagen(LaagModel.setViewInstellingen(vi)));
}
