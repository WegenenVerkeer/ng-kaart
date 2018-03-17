export type SubscriptionType = "Zoom" | "Zoombereik" | "Middelpunt" | "Achtergrond";

export type Subscription<Msg> =
  | ZoomNiveauSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | ZoomBereikSubscription<Msg>
  | AchtergrondTitelSubscription<Msg>;
// | BatchSubscription<Msg>
// | NoneSubscription;

export interface ZoomNiveauSubscription<Msg> {
  readonly type: "Zoom";
  readonly wrapper: (zoom: number) => Msg;
}

export interface ZoomBereikSubscription<Msg> {
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

// export interface BatchSubscrription<Msg> {
//   readonly type: "Batch";
//   readonly subs: Subscription<Msg>[];
// }

// export interface NoneSubscription {
//   readonly type: "None";
// }

export function ZoomNiveauSubscription<Msg>(wrapper: (zoom: number) => Msg): Subscription<Msg> {
  return {
    type: "Zoom",
    wrapper: wrapper
  };
}

export function ZoomBereikSubscription<Msg>(wrapper: (min: number, max: number) => Msg): Subscription<Msg> {
  return {
    type: "Zoombereik",
    wrapper: wrapper
  };
}

export function MiddelpuntSubscription<Msg>(wrapper: (x: number, y: number) => Msg): Subscription<Msg> {
  return {
    type: "Middelpunt",
    wrapper: wrapper
  };
}

export function AchtergrondTitelSubscription<Msg>(wrapper: (titel: string) => Msg): Subscription<Msg> {
  return {
    type: "Achtergrond",
    wrapper: wrapper
  };
}

// export function BatchSubscription<Msg>(...subs: Subscription<Msg>[]): Subscription<Msg> {
//   return {
//     type: "Batch",
//     subs: subs
//   };
// }

// export const noSubs: Subscription<any> = { type: "None" };
