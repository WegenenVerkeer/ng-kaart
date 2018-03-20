import { Observable } from "rxjs/Observable";
import { pipe } from "rxjs/Rx";
import { Option, some, none } from "fp-ts/lib/Option";

import { kaartLogger } from "./log";
import { Zoominstellingen } from "./kaart-protocol";
import * as prt from "./kaart-protocol";

export type KaartInternalSubMsg = SuccessMsg | ZoominstellingenGezetMsg;

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
    kaartLogger.error("Een intern command gaf een fout", v.value);
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

export interface ZoominstellingenGezetMsg {
  type: "ZoominstellingenGezet";
  zoominstellingen: Zoominstellingen;
}

function ZoominstellingenGezetMsg(instellingen: Zoominstellingen): ZoominstellingenGezetMsg {
  return { type: "ZoominstellingenGezet", zoominstellingen: instellingen };
}

export const zoominstellingenGezetWrapper = (instellingen: Zoominstellingen) => {
  return KaartInternalMsg(some(ZoominstellingenGezetMsg(instellingen)));
};
