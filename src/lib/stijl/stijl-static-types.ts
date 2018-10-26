import { identity, Refinement } from "fp-ts/lib/function";
import { fromRefinement } from "fp-ts/lib/Option";
import { Lens, Optional, Prism } from "monocle-ts";

import { Kleur, kleurcodeValue, olToKleur } from "./colour";

// De typedefinities hierna beschrijven de JSON-DSL voor static styles die we op dit moment ondersteunen.

export type Awv0StaticStyle = FullStyle;

export type ColorType = string; // Hier moet op termijn meer komen. O.a. Ndl naam

export interface FillStyle {
  color: ColorType;
}

export interface StrokeStyle {
  color?: ColorType;
  lineCap?: string; // Deze en volgende zouden fijner kunnen. Bijv. enums.
  lineJoin?: string;
  lineDash?: number;
  lineDashOffset?: number;
  miterLimit?: number;
  width?: number;
}

export type TextAlignType = "left" | "right" | "center" | "end" | "start";
export type TextPlacementType = "point" | "line";
export type TextBaselineType = "bottom" | "top" | "middle" | "alphabetic" | "hanging" | "ideographic";

export interface TextStyle {
  font?: string;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  rotateWithView?: boolean;
  rotation?: number;
  text?: string;
  textAlign?: TextAlignType;
  textBaseline?: TextBaselineType;
  placement?: TextPlacementType;
  fill?: FillStyle;
  stroke?: StrokeStyle;
}

export interface CircleStyle {
  radius: number;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  snapToPixel?: boolean;
}

export type IconOriginType = "bottom-left" | "bottom-right" | "top-left" | "top-right";
export type IconAnchorUnitsType = "fraction" | "pixels";
export type SizeType = [number, number];

export interface IconStyle {
  anchor?: number[];
  anchorOrigin?: IconOriginType;
  anchorXUnits?: IconAnchorUnitsType;
  anchorYUnits?: IconAnchorUnitsType;
  color?: ColorType;
  crossOrigin?: string;
  offset?: number[];
  offsetOrigin?: IconOriginType;
  opacity?: number;
  scale?: number;
  snapToPixel?: boolean;
  rotateWithView?: boolean;
  rotation?: number;
  size?: SizeType;
  imgSize?: SizeType;
  src?: string;
}

export interface RegularShapeStyle {
  fill?: FillStyle;
  points?: number;
  radius?: number;
  radius1?: number;
  radius2?: number;
  angle?: number;
  snapToPixel?: boolean;
  stroke?: StrokeStyle;
}

export interface FullStyle {
  fill?: FillStyle;
  stroke?: StrokeStyle;
  text?: TextStyle;
  circle?: CircleStyle;
  icon?: IconStyle;
  regularShape?: RegularShapeStyle;
}

/////////////////////////////////////////
// Manipulatie en inspectie van het model
//
const isFullStyle: Refinement<Awv0StaticStyle, FullStyle> = (ass): ass is FullStyle => !ass.hasOwnProperty("fullLine");
export const fullStylePrism: Prism<Awv0StaticStyle, FullStyle> = new Prism(fromRefinement(isFullStyle), identity);

export namespace FullStyle {
  export const circleOptional: Optional<FullStyle, CircleStyle> = Optional.fromNullableProp("circle");
}
export namespace Circle {
  export const fillOptional: Optional<CircleStyle, FillStyle> = Optional.fromNullableProp("fill");
}
export namespace Fill {
  export const colorLens: Lens<FillStyle, ColorType> = Lens.fromProp("color");
}
export namespace Color {
  export const kleurOptional: Optional<ColorType, Kleur> = new Optional(clr => olToKleur(clr), kleur => () => kleurcodeValue(kleur));
}
