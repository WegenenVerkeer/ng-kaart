import { Function1, Refinement } from "fp-ts/lib/function";

import * as ke from "../kaart/kaart-elementen";

export type FilterAanpassingState = FilterAanpassingBezig | GeenFilterAanpassingBezig;

export interface FilterAanpassingBezig {
  readonly type: "FilterAanpassingBezig";
  readonly laag: ke.ToegevoegdeVectorLaag;
}

export interface GeenFilterAanpassingBezig {
  readonly type: "GeenFilterAanpassingBezig";
}

export const FilterAanpassend: Function1<ke.ToegevoegdeVectorLaag, FilterAanpassingBezig> = tvlg => ({
  type: "FilterAanpassingBezig",
  laag: tvlg
});

export const GeenFilterAanpassingBezig: GeenFilterAanpassingBezig = { type: "GeenFilterAanpassingBezig" };

export const isAanpassingBezig: Refinement<FilterAanpassingState, FilterAanpassingBezig> = (state): state is FilterAanpassingBezig =>
  state.type === "FilterAanpassingBezig";

export const isAanpassingNietBezig: Refinement<FilterAanpassingState, FilterAanpassingBezig> = (state): state is FilterAanpassingBezig =>
  state.type === "GeenFilterAanpassingBezig";
