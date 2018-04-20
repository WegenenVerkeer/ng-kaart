import { Option } from "fp-ts/lib/Option";
import { List } from "immutable";
import { ZoekResultaten } from "../zoeker";

import { AchtergrondLaag, TypedRecord } from ".";

/////////
// Types
//

export type Subscription<Msg> =
  | ZoominstellingenSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | GeselecteerdeFeaturesSubscription<Msg>
  | AchtergrondTitelSubscription<Msg>
  | AchtergrondlagenSubscription<Msg>
  | ZoekerSubscription<Msg>
  | MijnLocatieZoomdoelSubscription<Msg>
  | KaartClickSubscription<Msg>;

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

export interface GeselecteerdeFeaturesSubscription<Msg> {
  readonly type: "GeselecteerdeFeatures";
  readonly wrapper: (geselecteerdeFeatures: List<ol.Feature>) => Msg;
}

export interface AchtergrondTitelSubscription<Msg> {
  readonly type: "Achtergrond";
  readonly wrapper: (titel: string) => Msg;
}

export interface AchtergrondlagenSubscription<Msg> {
  readonly type: "Achtergrondlagen";
  readonly wrapper: (achtergrondlagen: List<AchtergrondLaag>) => Msg;
}

export interface KaartClickSubscription<Msg> {
  readonly type: "KaartClick";
  readonly wrapper: (coordinaat: ol.Coordinate) => Msg;
}

export interface ZoekerSubscription<Msg> {
  readonly type: "Zoeker";
  readonly wrapper: (resultaten: ZoekResultaten) => Msg;
}

export interface MijnLocatieZoomdoelSubscription<Msg> {
  readonly type: "MijnLocatieZoomdoel";
  readonly wrapper: (doel: Option<number>) => Msg;
}

///////////////
// Constructors
//

export function ZoominstellingenSubscription<Msg>(wrapper: (settings: Zoominstellingen) => Msg): ZoominstellingenSubscription<Msg> {
  return { type: "Zoominstellingen", wrapper: wrapper };
}

export function GeselecteerdeFeaturesSubscription<Msg>(
  wrapper: (geselecteerdeFeatures: List<ol.Feature>) => Msg
): GeselecteerdeFeaturesSubscription<Msg> {
  return { type: "GeselecteerdeFeatures", wrapper: wrapper };
}

export function MiddelpuntSubscription<Msg>(wrapper: (x: number, y: number) => Msg): MiddelpuntSubscription<Msg> {
  return { type: "Middelpunt", wrapper: wrapper };
}

export function AchtergrondTitelSubscription<Msg>(wrapper: (titel: string) => Msg): AchtergrondTitelSubscription<Msg> {
  return { type: "Achtergrond", wrapper: wrapper };
}

export function AchtergrondlagenSubscription<Msg>(
  wrapper: (achtergrondlagen: List<AchtergrondLaag>) => Msg
): AchtergrondlagenSubscription<Msg> {
  return { type: "Achtergrondlagen", wrapper: wrapper };
}

export function ZoekerSubscription<Msg>(wrapper: (resultaten: ZoekResultaten) => Msg): Subscription<Msg> {
  return { type: "Zoeker", wrapper: wrapper };
}

export function KaartClickSubscription<Msg>(wrapper: (coordinaat: ol.Coordinate) => Msg): Subscription<Msg> {
  return { type: "KaartClick", wrapper: wrapper };
}

export function MijnLocatieZoomdoelSubscription<Msg>(wrapper: (doel: Option<number>) => Msg): MijnLocatieZoomdoelSubscription<Msg> {
  return { type: "MijnLocatieZoomdoel", wrapper: wrapper };
}
