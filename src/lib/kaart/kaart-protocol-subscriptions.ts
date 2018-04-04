import { KaartMsg, AchtergrondLaag } from ".";
import { List } from "immutable";

export type Subscription<Msg extends KaartMsg> =
  | ZoominstellingenSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | AchtergrondTitelSubscription<Msg>
  | AchtergrondlagenSubscription<Msg>
  | GeometryChangedSubscription<Msg>
  | MetenLengteOppervlakteSubscription<Msg>;

export interface Zoominstellingen {
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface ZoominstellingenSubscription<Msg> {
  readonly type: "Zoominstellingen";
  readonly wrapper: (instellingen: Zoominstellingen) => Msg;
}

export interface MiddelpuntSubscription<Msg> {
  readonly type: "Middelpunt";
  readonly wrapper: (x: number, y: number) => Msg;
}

export interface AchtergrondTitelSubscription<Msg> {
  readonly type: "Achtergrond";
  readonly wrapper: (titel: string) => Msg;
}

export interface AchtergrondlagenSubscription<Msg> {
  readonly type: "Achtergrondlagen";
  readonly wrapper: (achtergrondlagen: List<AchtergrondLaag>) => Msg;
}

export interface GeometryChangedSubscription<Msg> {
  readonly type: "GeometryChanged";
  readonly wrapper: (evt: ol.geom.Geometry) => Msg;
}

export interface MetenLengteOppervlakteSubscription<Msg> {
  readonly type: "MetenLengteOppervlakte";
  readonly wrapper: (boolean) => Msg;
}

export function ZoominstellingenSubscription<Msg extends KaartMsg>(wrapper: (settings: Zoominstellingen) => Msg): Subscription<Msg> {
  return {
    type: "Zoominstellingen",
    wrapper: wrapper
  };
}

export function MiddelpuntSubscription<Msg extends KaartMsg>(wrapper: (x: number, y: number) => Msg): Subscription<Msg> {
  return {
    type: "Middelpunt",
    wrapper: wrapper
  };
}

export function AchtergrondTitelSubscription<Msg extends KaartMsg>(wrapper: (titel: string) => Msg): Subscription<Msg> {
  return {
    type: "Achtergrond",
    wrapper: wrapper
  };
}

export function AchtergrondlagenSubscription<Msg extends KaartMsg>(
  wrapper: (achtergrondlagen: List<AchtergrondLaag>) => Msg
): Subscription<Msg> {
  return {
    type: "Achtergrondlagen",
    wrapper: wrapper
  };
}

export function GeometryChangedSubscription<Msg extends KaartMsg>(wrapper: (evt: ol.geom.Geometry) => Msg): Subscription<Msg> {
  return {
    type: "GeometryChanged",
    wrapper: wrapper
  };
}

export function MetenLengteOppervlakteSubscription<Msg extends KaartMsg>(wrapper: (boolean) => Msg): Subscription<Msg> {
  return {
    type: "MetenLengteOppervlakte",
    wrapper: wrapper
  };
}
