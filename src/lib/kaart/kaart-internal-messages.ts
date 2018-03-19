import * as prt from "./kaart-protocol";
import { Option, some, none } from "fp-ts/lib/Option";
import { kaartLogger } from "./log";

export type KaartInternalSubMsg = SuccessMsg | ZoomGezetMsg;

export interface KaartInternalMsg extends prt.KaartMsg {
  type: "KaartInternal";
  payload: Option<KaartInternalSubMsg>;
}

function KaartInternalMsg(payload: Option<KaartInternalSubMsg>): KaartInternalMsg {
  return {
    type: "KaartInternal",
    payload: payload
  };
}

// Dit is echt "fire and forget". Geen enkele informatie komt terug
export const forgetWrapper: prt.VoidWrapper<KaartInternalMsg> = (v: prt.KaartCmdValidation<KaartInternalMsg>) => {
  if (v.isFailure()) {
    kaartLogger.error("Een internet command gaf eem fout", v.value);
  }
  return {
    type: "KaartInternal",
    payload: none
  };
};

export interface SuccessMsg {
  type: "SuccessOrNot";
  payload: prt.KaartCmdValidation<any>;
}

export function SuccessMsg(v: prt.KaartCmdValidation<any>): SuccessMsg {
  return { type: "SuccessOrNot", payload: v };
}

export function successWrapper(): prt.VoidWrapper<KaartInternalMsg> {
  return (v: prt.KaartCmdValidation<any>) => ({
    type: "KaartInternal",
    payload: some(SuccessMsg(v))
  });
}

export interface ZoomGezetMsg {
  type: "ZoomGezet";
  zoom: number;
}

function ZoomGezetMsg(zoom: number): ZoomGezetMsg {
  return { type: "ZoomGezet", zoom: zoom };
}

export const zoomGezetWrapper = (zoom: number) => KaartInternalMsg(some(ZoomGezetMsg(zoom)));
