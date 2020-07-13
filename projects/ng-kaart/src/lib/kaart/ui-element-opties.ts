import { option } from "fp-ts";

import * as maps from "../util/maps";

export type OptiesRecord = Record<string, unknown>;
export type OptiesOpUiElement = Map<string, object>;

export namespace OptiesOpUiElement {
  export const create = (): OptiesOpUiElement => new Map();

  export const getOption = <A extends object>(uiSelector: string) => (optiesMap: OptiesOpUiElement): option.Option<A> =>
    option.fromNullable(optiesMap.get(uiSelector) as A);

  export const set = <A extends object>(a: A) => (uiSelector: string) => (optiesMap: OptiesOpUiElement): OptiesOpUiElement =>
    maps.set(optiesMap, uiSelector, a);

  // Vul enkel de niet reeds gezette optie waarden toe. Het probleem is dat wegens de Angular life-cycle classic
  // componenten volledig opgebouwd zijn vooraleer de onderliggende kaartsubcomponent geïnitialiseerd wordt. We willen
  // dat alle default waarden gezet zijn, maar tegelijkertijd ook dat de waarden die de classic component zet behouden worden.
  export const init = <A extends object>(a: A) => (uiSelector: string) => (optiesMap: OptiesOpUiElement): OptiesOpUiElement =>
    set({ ...a, ...optiesMap.get(uiSelector) })(uiSelector)(optiesMap);

  // Uit de element optie stream hoeven niet enkel objecten te komen die alle properties van het optietype bevatten. De
  // properties die niet gezet zijn, worden overgenomen van de recentste keer dat ze gezet waren.
  export const extend = <A extends object>(a: A) => (uiSelector: string) => (optiesMap: OptiesOpUiElement): OptiesOpUiElement =>
    set({ ...optiesMap.get(uiSelector), ...a })(uiSelector)(optiesMap);
}
