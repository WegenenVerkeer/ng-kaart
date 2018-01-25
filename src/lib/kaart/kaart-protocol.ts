import { KaartWithInfo } from "./kaart-with-info";

export * from "./kaart-protocol-events";

export type ModelConsumer<A> = (a: A) => void;

export const noOpModelConsumer: ModelConsumer<any> = (model: any) => undefined;
