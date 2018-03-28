import { Validation } from "fp-ts/lib/Validation";

export * from "./kaart-protocol-commands";
export * from "./kaart-protocol-subscriptions";

export interface KaartMsg {
  type: string;
}

export type ModelConsumer<A> = (a: A) => void;
export type MessageConsumer<Msg extends KaartMsg> = (msg: Msg) => void;
export type Subscriber<Msg extends KaartMsg> = (mc: MessageConsumer<Msg>) => void;

export type KaartCmdValidation<T> = Validation<string[], T>;
export type Wrapper<T, Msg extends KaartMsg> = (t: T) => Msg;
export type VoidWrapper<Msg extends KaartMsg> = Wrapper<undefined, Msg>;
export type ValidationWrapper<T, Msg extends KaartMsg> = Wrapper<KaartCmdValidation<T>, Msg>;
export type BareValidationWrapper<Msg extends KaartMsg> = ValidationWrapper<undefined, Msg>;

export const noOpModelConsumer: ModelConsumer<any> = () => undefined;
export const noOpMessageConsumer: MessageConsumer<KaartMsg> = () => undefined;
