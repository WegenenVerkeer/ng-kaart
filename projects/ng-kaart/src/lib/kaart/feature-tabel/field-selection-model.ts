import { array, eq, option, ord } from "fp-ts";
import { Endomorphism, flow, Predicate } from "fp-ts/lib/function";
import { Getter, Lens } from "monocle-ts";

import * as arrays from "../../util/arrays";
import { arrayTraversal } from "../../util/lenses";
import * as ke from "../kaart-elementen";

import { FieldSorting, SortDirection } from "./data-provider";

export interface FieldSelection {
  readonly name: string;
  readonly label: string;
  readonly selected: boolean;
  readonly sortDirection: option.Option<SortDirection>;
  readonly contributingVeldinfos: ke.VeldInfo[]; // voor de synthetische velden
}

export namespace FieldSelection {
  export const nameLens: Lens<FieldSelection, string> = Lens.fromProp<
    FieldSelection
  >()("name");
  export const selectedLens: Lens<FieldSelection, boolean> = Lens.fromProp<
    FieldSelection
  >()("selected");
  export const contributingVeldinfosGetter: Getter<
    FieldSelection,
    ke.VeldInfo[]
  > = Lens.fromProp<FieldSelection>()("contributingVeldinfos").asGetter();
  export const maybeSortDirectionLens: Lens<
    FieldSelection,
    option.Option<SortDirection>
  > = Lens.fromProp<FieldSelection>()("sortDirection");
  export const isSelected: Predicate<FieldSelection> = selectedLens.get;
  export const isSortField: Predicate<FieldSelection> = flow(
    maybeSortDirectionLens.get,
    option.isSome
  );

  const basisVeldOrd: ord.Ord<ke.VeldInfo> = ord.contramap(
    ke.VeldInfo.isBasisveldLens.get
  )(ord.getDualOrd(ord.ordBoolean));

  const hasSupportedType: (
    vi: ke.VeldInfo
  ) => boolean = ke.VeldInfo.matchWithFallback({
    boolean: () => true,
    date: () => true,
    double: () => true,
    integer: () => true,
    string: () => true,
    url: () => true,
    fallback: () => false,
  });

  export const fieldsFromVeldinfo: (
    arg: ke.VeldInfo[]
  ) => FieldSelection[] = flow(
    array.sortBy<ke.VeldInfo>([basisVeldOrd]),
    array.filter(hasSupportedType),
    array.map((vi) => ({
      name: vi.naam,
      label: ke.VeldInfo.veldGuaranteedLabelGetter.get(vi),
      selected: false,
      sortDirection: option.none,
      contributingVeldinfos: [vi],
    }))
  );

  const isBaseField: Predicate<FieldSelection> = (field) =>
    arrays.exists(ke.VeldInfo.isBasisveldLens.get)(field.contributingVeldinfos);

  export const selectBaseFields: Endomorphism<
    FieldSelection[]
  > = arrayTraversal<FieldSelection>().modify((field) =>
    selectedLens.set(isBaseField(field))(field)
  );

  export const selectAllFields: Endomorphism<FieldSelection[]> = arrayTraversal<
    FieldSelection
  >().modify(selectedLens.set(true));

  export const selectedVeldnamen: (arg: FieldSelection[]) => string[] = flow(
    array.filter(selectedLens.get),
    array.map(nameLens.get)
  );

  export const setoidFieldSelection: eq.Eq<FieldSelection> = eq.getStructEq({
    name: eq.eqString,
    selected: eq.eqBoolean,
    sortDirection: option.getEq(SortDirection.setoidSortDirection),
  });

  export const setoidFieldSelectionByKey: eq.Eq<FieldSelection> = eq.contramap(
    nameLens.get
  )(eq.eqString);

  export const selectFirstField: Endomorphism<
    FieldSelection[]
  > = array.mapWithIndex<FieldSelection, FieldSelection>((i, field) =>
    selectedLens.modify((set) => set || i === 0)(field)
  );

  export const selectOnlyFirstAndSortedField: Endomorphism<
    FieldSelection[]
  > = array.mapWithIndex<FieldSelection, FieldSelection>((i, field) =>
    selectedLens.set(i === 0 || option.isSome(field.sortDirection))(field)
  );

  const sortingsForFieldSelection: (arg: FieldSelection) => FieldSorting[] = (
    fs
  ) =>
    option.fold(
      () => [],
      (direction) =>
        fs.contributingVeldinfos.map(FieldSorting.create(direction))
    )(fs.sortDirection);

  export const maintainFieldSortings: (
    arg: FieldSelection[]
  ) => FieldSorting[] = array.chain(sortingsForFieldSelection);
}
