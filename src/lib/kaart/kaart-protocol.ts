export * from "./kaart-protocol-events";
export * from "./kaart-protocol-subscriptions";

export type ModelConsumer<A> = (a: A) => void;

// noinspection JSUnusedLocalSymbols
export const noOpModelConsumer: ModelConsumer<any> = (model: any) => undefined;
