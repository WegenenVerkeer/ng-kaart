export * from "./kaart-protocol-commands";
export * from "./kaart-protocol-subscriptions";

export type ModelConsumer<A> = (a: A) => void;
export type MessageConsumer<Msg> = (msg: Msg) => void;

// noinspection JSUnusedLocalSymbols
export const noOpModelConsumer: ModelConsumer<any> = (model: any) => undefined;
export const noOpMessageConsumer: MessageConsumer<any> = (msg: any) => undefined;
