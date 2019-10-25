import { array, option, ord, setoid } from "fp-ts";
import { Endomorphism, flow, Function1, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Ord } from "fp-ts/lib/Ord";
import { Setoid } from "fp-ts/lib/Setoid";
import { Getter, Lens } from "monocle-ts";

import * as arrays from "../../util/arrays";
import { arrayTraversal } from "../../util/lenses";
import * as ke from "../kaart-elementen";

import { FieldSorting, SortDirection } from "./data-provider";

export interface FieldSelection {
  readonly name: string;
  readonly label: string;
  readonly selected: boolean;
  readonly sortDirection: Option<SortDirection>;
  readonly contributingVeldinfos: ke.VeldInfo[]; // voor de synthetische velden
}

export namespace FieldSelection {
  export const nameLens: Lens<FieldSelection, string> = Lens.fromProp<FieldSelection>()("name");
  export const selectedLens: Lens<FieldSelection, boolean> = Lens.fromProp<FieldSelection>()("selected");
  export const contributingVeldinfosGetter: Getter<FieldSelection, ke.VeldInfo[]> = Lens.fromProp<FieldSelection>()(
    "contributingVeldinfos"
  ).asGetter();
  export const maybeSortDirectionLens: Lens<FieldSelection, Option<SortDirection>> = Lens.fromProp<FieldSelection>()("sortDirection");
  export const isSelected: Predicate<FieldSelection> = selectedLens.get;
  export const isSortField: Predicate<FieldSelection> = flow(
    maybeSortDirectionLens.get,
    option.isSome
  );

  const basisVeldOrd: Ord<ke.VeldInfo> = ord.contramap(ke.VeldInfo.isBasisveldLens.get)(ord.getDualOrd(ord.ordBoolean));

  export const fieldsFromVeldinfo: Function1<ke.VeldInfo[], FieldSelection[]> = flow(
    array.sortBy1(basisVeldOrd, []),
    array.map(vi => ({
      name: vi.naam,
      label: ke.VeldInfo.veldGuaranteedLabelGetter.get(vi),
      selected: false,
      sortDirection: option.none,
      contributingVeldinfos: [vi]
    }))
  );

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

  export const selectFirstField: Endomorphism<FieldSelection[]> = array.mapWithIndex<FieldSelection, FieldSelection>((i, field) =>
    selectedLens.modify(set => set || i === 0)(field)
  );

  export const selectOnlyFirstField: Endomorphism<FieldSelection[]> = array.mapWithIndex<FieldSelection, FieldSelection>((i, field) =>
    selectedLens.set(i === 0)(field)
  );

  const sortingsForFieldSelection: Function1<FieldSelection, FieldSorting[]> = fs =>
    fs.sortDirection.foldL(() => [], direction => fs.contributingVeldinfos.map(FieldSorting.create(direction)));

  export const maintainFieldSortings: Function1<FieldSelection[], FieldSorting[]> = array.chain(sortingsForFieldSelection);
}
