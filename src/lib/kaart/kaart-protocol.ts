import { Either } from "fp-ts/lib/Either";

export * from "./kaart-protocol-commands";
export * from "./kaart-protocol-subscriptions";

export type ModelConsumer<A> = (a: A) => void;
export type MessageConsumer<Failure, Msg> = (result: Either<Failure, Msg>) => void;

export const noOpModelConsumer: ModelConsumer<any> = () => undefined;
export const noOpMessageConsumer: MessageConsumer<any, any> = () => undefined;
