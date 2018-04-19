import { Option } from "fp-ts/lib/Option";
import { List } from "immutable";
import { ZoekResultaten } from "../zoeker";

import { AchtergrondLaag, TypedRecord } from ".";

/////////
// Types
//

export type Subscription<Msg extends TypedRecord> =
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

export interface ZoominstellingenSubscription<Msg extends TypedRecord> {
  readonly type: "Zoominstellingen";
  readonly wrapper: (instellingen: Zoominstellingen) => Msg;
}

export interface MiddelpuntSubscription<Msg extends TypedRecord> {
  readonly type: "Middelpunt";
  readonly wrapper: (x: number, y: number) => Msg;
}

export interface GeselecteerdeFeaturesSubscription<Msg extends TypedRecord> {
  readonly type: "GeselecteerdeFeatures";
  readonly wrapper: (geselecteerdeFeatures: List<ol.Feature>) => Msg;
}

export interface AchtergrondTitelSubscription<Msg extends TypedRecord> {
  readonly type: "Achtergrond";
  readonly wrapper: (titel: string) => Msg;
}

export interface AchtergrondlagenSubscription<Msg extends TypedRecord> {
  readonly type: "Achtergrondlagen";
  readonly wrapper: (achtergrondlagen: List<AchtergrondLaag>) => Msg;
}

export interface KaartClickSubscription<Msg extends TypedRecord> {
  readonly type: "KaartClick";
  readonly wrapper: (coordinaat: ol.Coordinate) => Msg;
}

export interface ZoekerSubscription<Msg extends TypedRecord> {
  readonly type: "Zoeker";
  readonly wrapper: (resultaten: ZoekResultaten) => Msg;
}

export interface MijnLocatieZoomdoelSubscription<Msg extends TypedRecord> {
  readonly type: "MijnLocatieZoomdoel";
  readonly wrapper: (doel: Option<number>) => Msg;
}

///////////////
// Constructors
//

export function ZoominstellingenSubscription<Msg extends TypedRecord>(
  wrapper: (settings: Zoominstellingen) => Msg
): ZoominstellingenSubscription<Msg> {
  return { type: "Zoominstellingen", wrapper: wrapper };
}

export function GeselecteerdeFeaturesSubscription<Msg extends TypedRecord>(
  wrapper: (geselecteerdeFeatures: List<ol.Feature>) => Msg
): GeselecteerdeFeaturesSubscription<Msg> {
  return { type: "GeselecteerdeFeatures", wrapper: wrapper };
}

export function MiddelpuntSubscription<Msg extends TypedRecord>(wrapper: (x: number, y: number) => Msg): MiddelpuntSubscription<Msg> {
  return { type: "Middelpunt", wrapper: wrapper };
}

export function AchtergrondTitelSubscription<Msg extends TypedRecord>(wrapper: (titel: string) => Msg): AchtergrondTitelSubscription<Msg> {
  return { type: "Achtergrond", wrapper: wrapper };
}

export function AchtergrondlagenSubscription<Msg extends TypedRecord>(
  wrapper: (achtergrondlagen: List<AchtergrondLaag>) => Msg
): AchtergrondlagenSubscription<Msg> {
  return { type: "Achtergrondlagen", wrapper: wrapper };
}

export function ZoekerSubscription<Msg extends TypedRecord>(wrapper: (resultaten: ZoekResultaten) => Msg): Subscription<Msg> {
  return { type: "Zoeker", wrapper: wrapper };
}

export function KaartClickSubscription<Msg extends TypedRecord>(wrapper: (coordinaat: ol.Coordinate) => Msg): Subscription<Msg> {
  return { type: "KaartClick", wrapper: wrapper };
}

export function MijnLocatieZoomdoelSubscription<Msg extends TypedRecord>(
  wrapper: (doel: Option<number>) => Msg
): MijnLocatieZoomdoelSubscription<Msg> {
  return { type: "MijnLocatieZoomdoel", wrapper: wrapper };
}
