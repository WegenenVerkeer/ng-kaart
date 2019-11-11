import { option } from "fp-ts";
import { Option } from "fp-ts/lib/Option";

import * as maps from "../util/maps";

export type OptiesOpUiElement = Map<string, object>;

export namespace OptiesOpUiElement {
  export const create = (): OptiesOpUiElement => new Map();

  export const get = <A>(uiSelector: string) => (optiesMap: OptiesOpUiElement): Option<A> =>
    option.fromNullable((optiesMap.get(uiSelector) as unknown) as A);

  export const set = <A extends Object>(a: A) => (uiSelector: string) => (optiesMap: OptiesOpUiElement): OptiesOpUiElement =>
    maps.set(optiesMap, uiSelector, a);

  export const init = <A extends Object>(a: A) => (uiSelector: string) => (optiesMap: OptiesOpUiElement): OptiesOpUiElement =>
    optiesMap.has(uiSelector) ? optiesMap : set(a)(uiSelector)(optiesMap);

  // Uit de element optie stream hoeven niet enkel objecten te komen die alle properties van het optietype bevatten. De
  // properties die niet gezet zijn, worden overgenomen van de recentste keer dat ze gezet waren.
  export const extend = <A extends Object>(a: A) => (uiSelector: string) => (optiesMap: OptiesOpUiElement): OptiesOpUiElement =>
    set({ ...optiesMap.get(uiSelector), ...a })(uiSelector)(optiesMap);
}
