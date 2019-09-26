import { setoid } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";
import { Setoid } from "fp-ts/lib/Setoid";
import { Lens } from "monocle-ts";

import { LaagModel } from "./laag-model";

export interface TableHeader {
  readonly titel: string;
  readonly filterIsActive: boolean;
  readonly hasFilter: boolean;
  readonly count: number | undefined;
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
    count: setoid.setoidNumber
  });
}
