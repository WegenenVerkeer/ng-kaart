import { array, option, record } from "fp-ts";
import { flow } from "fp-ts/lib/function";

import * as arrays from "../../util/arrays";
import * as ke from "../kaart-elementen";

import { FieldSelection } from "./field-selection-model";

export type Alignment = "left" | "center" | "right";

export namespace Alignment {
  const fromVeldinfo: (
    vi: ke.VeldInfo
  ) => Alignment = ke.VeldInfo.matchWithFallback({
    integer: () => "right" as "right",
    double: () => "right" as "right",
    fallback: () => "left" as "left",
  });

  const fromFieldSelection: (
    fieldSelection: FieldSelection
  ) => Alignment = flow(
    FieldSelection.contributingVeldinfosGetter.get,
    arrays.asSingleton,
    option.fold(
      () => "left" as "left",
      ([head]) => fromVeldinfo(head)
    )
  );

  export const createFromFieldSelection: (
    fieldSelections: FieldSelection[]
  ) => Record<string, Alignment> = array.reduce({}, (rec, fieldSelection) =>
    record.insertAt(
      fieldSelection.name,
      fromFieldSelection(fieldSelection)
    )(rec)
  );
}
