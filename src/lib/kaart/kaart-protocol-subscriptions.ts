import { KaartMsg } from ".";

export type SubscriptionType = "Zoom" | "Zoombereik" | "Middelpunt" | "Achtergrond";

export type Subscription<Msg extends KaartMsg> =
  | ZoomNiveauSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | ZoombereikSubscription<Msg>
  | AchtergrondTitelSubscription<Msg>;

export interface ZoomNiveauSubscription<Msg extends KaartMsg> {
  readonly type: "Zoom";
  readonly wrapper: (zoom: number) => Msg;
}

export interface ZoombereikSubscription<Msg> {
  readonly type: "Zoombereik";
  readonly wrapper: (zoomMin: number, zoomMax: number) => Msg;
}

export interface MiddelpuntSubscription<Msg> {
  readonly type: "Middelpunt";
  readonly wrapper: (x: number, y: number) => Msg;
}

export interface AchtergrondTitelSubscription<Msg> {
  readonly type: "Achtergrond";
  readonly wrapper: (titel: string) => Msg;
}

export function ZoomNiveauSubscription<Msg extends KaartMsg>(wrapper: (zoom: number) => Msg): Subscription<Msg> {
  return {
    type: "Zoom",
    wrapper: wrapper
  };
}

export function ZoomBereikSubscription<Msg extends KaartMsg>(wrapper: (min: number, max: number) => Msg): Subscription<Msg> {
  return {
    type: "Zoombereik",
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
