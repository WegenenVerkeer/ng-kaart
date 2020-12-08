import { eq } from "fp-ts";
import { Lens } from "monocle-ts";

import { LaagModel } from "./laag-model";

export interface TableHeader {
  readonly titel: string;
  readonly filterIsActive: boolean;
  readonly hasFilter: boolean;
  readonly count: number | undefined;
}

export namespace TableHeader {
  export const filterIsActiveLens: Lens<TableHeader, boolean> = Lens.fromProp<
    TableHeader
  >()("filterIsActive");

  export const toHeader: (arg: LaagModel) => TableHeader = (laag) => ({
    titel: laag.titel,
    filterIsActive: laag.filterIsActive,
    hasFilter: laag.hasFilter,
    count:
      laag.featureCount.kind === "FeatureCountFetched"
        ? laag.featureCount.count
        : undefined,
  });

  export const setoidTableHeader: eq.Eq<TableHeader> = eq.getStructEq({
    titel: eq.eqString,
    filterIsActive: eq.eqBoolean,
    hasFilter: eq.eqBoolean,
    count: eq.eqNumber,
  });
}
