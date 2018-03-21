import { Observable } from "rxjs/Observable";
import { pipe } from "rxjs/Rx";
import { Option, some, none } from "fp-ts/lib/Option";

import { kaartLogger } from "./log";
import { Zoominstellingen } from "./kaart-protocol";
import * as prt from "./kaart-protocol";
import { AchtergrondLaag } from ".";
import { List } from "immutable";

export type KaartInternalSubMsg = ZoominstellingenGezetMsg | AchtergrondtitelGezetMsg | AchtergrondlagenGezetMsg;

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

// Dit is echt "fire and forget". Geen enkele informatie komt terug ook al zou dat kunnen
export const forgetWrapper: prt.ValidationWrapper<any, KaartInternalMsg> = (v: prt.KaartCmdValidation<any>) => {
  if (v.isFailure()) {
    kaartLogger.error("Een intern command gaf een fout", v.value);
  }
  return {
    type: "KaartInternal",
    payload: none
  };
};

// Te gebruiken in Geoloket

// export interface SuccessMsg {
//   type: "SuccessOrNot";
//   payload: prt.KaartCmdValidation<any>;
// }

// export function SuccessMsg(v: prt.KaartCmdValidation<any>): SuccessMsg {
//   return { type: "SuccessOrNot", payload: v };
// }

// export function successWrapper(): prt.VoidWrapper<KaartInternalMsg> {
//   return (v: prt.KaartCmdValidation<any>) => ({
//     type: "KaartInternal",
//     payload: some(SuccessMsg(v))
//   });
// }

export interface ZoominstellingenGezetMsg {
  type: "ZoominstellingenGezet";
  zoominstellingen: Zoominstellingen;
}

function ZoominstellingenGezetMsg(instellingen: Zoominstellingen): ZoominstellingenGezetMsg {
  return { type: "ZoominstellingenGezet", zoominstellingen: instellingen };
}

export const zoominstellingenGezetWrapper = (instellingen: Zoominstellingen) =>
  KaartInternalMsg(some(ZoominstellingenGezetMsg(instellingen)));

export interface AchtergrondtitelGezetMsg {
  type: "AchtergrondtitelGezet";
  titel: string;
}

function AchtergrondtitelGezetMsg(titel: string): AchtergrondtitelGezetMsg {
  return { type: "AchtergrondtitelGezet", titel: titel };
}

export const achtergrondtitelGezetWrapper = (titel: string) => KaartInternalMsg(some(AchtergrondtitelGezetMsg(titel)));

export interface AchtergrondlagenGezetMsg {
  type: "AchtergrondlagenGezet";
  achtergrondlagen: List<AchtergrondLaag>;
}

function AchtergrondlagenGezetMsg(achtergrondlagen: List<AchtergrondLaag>): AchtergrondlagenGezetMsg {
  return { type: "AchtergrondlagenGezet", achtergrondlagen: achtergrondlagen };
}

export const achtergrondlagenGezetWrapper = (lagen: List<AchtergrondLaag>) => KaartInternalMsg(some(AchtergrondlagenGezetMsg(lagen)));
