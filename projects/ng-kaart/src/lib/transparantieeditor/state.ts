import { Refinement } from "fp-ts/lib/function";

import * as ke from "../kaart/kaart-elementen";

export type TransparantieaanpassingState =
  | TransparantieaanpassingBezig
  | GeenTransparantieaanpassingBezig;

export interface TransparantieaanpassingBezig {
  readonly type: "TransparantieaanpassingBezig";
  readonly laag: ke.ToegevoegdeLaag;
}

export interface GeenTransparantieaanpassingBezig {
  readonly type: "GeenTransparantieaanpassingBezig";
}

export const Transparantieaanpassend: (
  arg: ke.ToegevoegdeLaag
) => TransparantieaanpassingBezig = (laag) => ({
  type: "TransparantieaanpassingBezig",
  laag,
});

export const GeenTransparantieaanpassingBezig: GeenTransparantieaanpassingBezig = {
  type: "GeenTransparantieaanpassingBezig",
};

export const isAanpassingBezig: Refinement<
  TransparantieaanpassingState,
  TransparantieaanpassingBezig
> = (state): state is TransparantieaanpassingBezig =>
  state.type === "TransparantieaanpassingBezig";

export const isAanpassingNietBezig: Refinement<
  TransparantieaanpassingState,
  TransparantieaanpassingBezig
> = (state): state is TransparantieaanpassingBezig =>
  state.type === "GeenTransparantieaanpassingBezig";
