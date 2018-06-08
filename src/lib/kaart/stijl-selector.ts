import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import { offsetStyleFunction } from "../stijl/offset-stijl-function";

// Het type dat OpenLayers gebruikt voor stylen, maar niet expliciet definieert
export type Stylish = ol.StyleFunction | ol.style.Style | ol.style.Style[];

// Onze type-safe versie van het Openlayers Stylish type (homomorf)
export type StyleSelector = StaticStyle | DynamicStyle | Styles;

export interface StaticStyle {
  readonly type: "StaticStyle";
  readonly style: ol.style.Style;
}

export interface DynamicStyle {
  readonly type: "DynamicStyle";
  readonly styleFunction: ol.StyleFunction;
}

export interface Styles {
  readonly type: "Styles";
  readonly styles: Array<ol.style.Style>;
}

export function matchStyleSelector<A>(f: (_: StaticStyle) => A, g: (_: DynamicStyle) => A, h: (_: Styles) => A): (_: StyleSelector) => A {
  return styleSelector => {
    switch (styleSelector.type) {
      case "StaticStyle":
        return f(styleSelector);
      case "DynamicStyle":
        return g(styleSelector);
      case "Styles":
        return h(styleSelector);
    }
  };
}

export const toStylish: (_: StyleSelector) => Stylish = matchStyleSelector<Stylish>(s => s.style, s => s.styleFunction, s => s.styles);

export function asStyleSelector(stp: Stylish): Option<StyleSelector> {
  // TODO kies een of ander unieke property van ol.style.Style
  if (stp instanceof ol.style.Style) {
    return some(StaticStyle(stp));
  } else if (typeof stp === "function") {
    return some(DynamicStyle(stp as ol.StyleFunction));
  } else if (Array.isArray(stp)) {
    return some(Styles(stp as ol.style.Style[]));
  } else {
    return none;
  }
}

export function StaticStyle(style: ol.style.Style): StyleSelector {
  return {
    type: "StaticStyle",
    style: style
  };
}

export function DynamicStyle(styleFunction: ol.StyleFunction): StyleSelector {
  return {
    type: "DynamicStyle",
    styleFunction: styleFunction
  };
}

export function Styles(styles: Array<ol.style.Style>): StyleSelector {
  return {
    type: "Styles",
    styles: styles
  };
}

interface StijlSelectorOpNaam {
  [laagnaam: string]: Option<StyleSelector>;
}

// Spijtig genoeg kan die niet in het model zelf zitten vermits de stijl functie in de interaction.Select control wordt
// gecreëerd wanneer het model nog leeg is, en het model van dat moment in zijn scope zit. Boevendien kan de stijl op
// elk moment aangepast worden.
const FEATURE_STIJL_OP_LAAG = "featureStijlOpLaag";
const SELECTIE_STIJL_OP_LAAG = "selectieStijlOpLaag";
const HOVER_STIJL_OP_LAAG = "hoverStijlOpLaag";

const featureStijlSelectorOpNaam: (map: ol.Map) => StijlSelectorOpNaam = map => map.get(FEATURE_STIJL_OP_LAAG);
const selectieStijlSelectorOpNaam: (map: ol.Map) => StijlSelectorOpNaam = map => map.get(SELECTIE_STIJL_OP_LAAG);
const hoverStijlSelectorOpNaam: (map: ol.Map) => StijlSelectorOpNaam = map => map.get(HOVER_STIJL_OP_LAAG);

export function initStyleSelectorsInMap(map: ol.Map): void {
  map.set(FEATURE_STIJL_OP_LAAG, {});
  map.set(SELECTIE_STIJL_OP_LAAG, {});
  map.set(HOVER_STIJL_OP_LAAG, {});
}

export function setFeatureStyleSelector(map: ol.Map, laagnaam: string, stijl: Option<StyleSelector>): void {
  featureStijlSelectorOpNaam(map)[laagnaam] = stijl;
}

export function clearFeatureStyleSelector(map: ol.Map, laagnaam: string): void {
  delete featureStijlSelectorOpNaam(map)[laagnaam];
}

export function getFeatureStyleSelector(map: ol.Map, laagnaam: string): Option<StyleSelector> {
  return featureStijlSelectorOpNaam(map)[laagnaam] || none;
}

export function setSelectionStyleSelector(map: ol.Map, laagnaam: string, stijl: Option<StyleSelector>): void {
  selectieStijlSelectorOpNaam(map)[laagnaam] = stijl;
}

export function deleteSelectionStyleSelector(map: ol.Map, laagnaam: string): void {
  delete selectieStijlSelectorOpNaam(map)[laagnaam];
}

export function getSelectionStyleSelector(map: ol.Map, laagnaam: string): Option<StyleSelector> {
  return selectieStijlSelectorOpNaam(map)[laagnaam] || none;
}

export function setHoverStyleSelector(map: ol.Map, laagnaam: string, stijl: Option<StyleSelector>): void {
  hoverStijlSelectorOpNaam(map)[laagnaam] = stijl;
}

export function getHoverStyleSelector(map: ol.Map, laagnaam: string): Option<StyleSelector> {
  return hoverStijlSelectorOpNaam(map)[laagnaam] || none;
}

export const offsetStyleSelector: (_1: string, _2: string, _3: number) => (_: StyleSelector) => StyleSelector = (
  ident8veld: string,
  offsetveld: string,
  stijlPositie: number
) =>
  matchStyleSelector<StyleSelector>(
    (s: StaticStyle) => s,
    (s: DynamicStyle) =>
      DynamicStyle(
        offsetStyleFunction(
          s.styleFunction,
          ident8veld,
          offsetveld,
          stijlPositie + 1 // 0-based, maar eerste laag moet ook offset hebben
        )
      ),
    (s: Styles) => s
  );
