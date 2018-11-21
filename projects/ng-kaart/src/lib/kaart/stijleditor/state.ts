import { Function1, Refinement } from "fp-ts/lib/function";

import * as ke from "../kaart-elementen";

export type LaagstijlaanpassingState = LaagstijlAanpassend | GeenLaagstijlaanpassing;

export interface LaagstijlAanpassend {
  readonly type: "aanpassingBezig";
  readonly laag: ke.ToegevoegdeVectorLaag;
}

export interface GeenLaagstijlaanpassing {
  readonly type: "geenAanpassing";
}

export const LaagstijlAanpassend: Function1<ke.ToegevoegdeVectorLaag, LaagstijlAanpassend> = tvlg => ({
  type: "aanpassingBezig",
  laag: tvlg
});

export const GeenLaagstijlaanpassing: GeenLaagstijlaanpassing = { type: "geenAanpassing" };

export const isAanpassingBezig: Refinement<LaagstijlaanpassingState, LaagstijlAanpassend> = (state): state is LaagstijlAanpassend =>
  state.type === "aanpassingBezig";
export const isAanpassingNietBezig: Refinement<LaagstijlaanpassingState, LaagstijlAanpassend> = (state): state is LaagstijlAanpassend =>
  state.type === "geenAanpassing";
