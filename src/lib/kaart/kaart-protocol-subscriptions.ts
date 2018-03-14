export type SubscriptionType = "Zoom" | "Middelpunt" | "Achtergrond";

export type Sub<Msg> = () => Msg;

export type Subscription<Msg> =
  | ZoomNiveauSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | AchtergrondTitelSubscription<Msg>
  | BatchSubscription<Msg>
  | NoneSubscription;

export interface ZoomNiveauSubscription<Msg> {
  readonly type: "Zoom";
  readonly wrapper: (zoom: number) => Msg;
}

export interface MiddelpuntSubscription<Msg> {
  readonly type: "Middelpunt";
  readonly wrapper: (x: number, y: number) => Msg;
}

export interface AchtergrondTitelSubscription<Msg> {
  readonly type: "Achtergrond";
  readonly wrapper: (titel: string) => Msg;
}

export interface BatchSubscription<Msg> {
  readonly type: "Batch";
  readonly subs: Subscription<Msg>[];
}

export interface NoneSubscription {
  readonly type: "None";
}

export function ZoomNiveauSubscription<Msg>(f: (zoom: number) => Msg): Subscription<Msg> {
  return {
    type: "Zoom",
    wrapper: f
  };
}

export function MiddelpuntSubscription<Msg>(f: (x: number, y: number) => Msg): Subscription<Msg> {
  return {
    type: "Middelpunt",
    wrapper: f
  };
}

export function AchtergrondTitelSubscription<Msg>(f: (titel: string) => Msg): Subscription<Msg> {
  return {
    type: "Achtergrond",
    wrapper: f
  };
}

export function BatchSubscription<Msg>(...subs: Subscription<Msg>[]): Subscription<Msg> {
  return {
    type: "Batch",
    subs: subs
  };
}

export const noSubs: Subscription<any> = { type: "None" };
