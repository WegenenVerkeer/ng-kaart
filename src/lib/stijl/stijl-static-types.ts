import { Function1, identity, Refinement } from "fp-ts/lib/function";
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
  lineDash?: number[];
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

export type ImageStyle = CircleStyle | IconStyle | RegularShapeStyle;

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
  points: number;
  fill?: FillStyle;
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
  image?: ImageStyle;
}

///////////////////////////
// Acessors & constructors
//

const isCircle: Refinement<ImageStyle, CircleStyle> = (img): img is CircleStyle => img.hasOwnProperty("radius");
const isIcon: Refinement<ImageStyle, IconStyle> = (icn): icn is IconStyle => !icn.hasOwnProperty("radius") && !icn.hasOwnProperty("points");
const isRegularShape: Refinement<ImageStyle, RegularShapeStyle> = (shp): shp is RegularShapeStyle => shp.hasOwnProperty("points");

export function matchImageStyle<A>(
  image: ImageStyle,
  fc: Function1<CircleStyle, A>,
  fi: Function1<IconStyle, A>,
  frs: Function1<RegularShapeStyle, A>
): A {
  return isCircle(image) ? fc(image) : isRegularShape(image) ? frs(image) : fi(image);
}

export function FullStyle(rec: { fill?: FillStyle; stroke?: StrokeStyle; text?: TextStyle; image?: ImageStyle }): FullStyle {
  return {
    fill: rec.fill,
    stroke: rec.stroke,
    text: rec.text,
    image: rec.image
  };
}

/////////////////////////////////////////
// Manipulatie en inspectie van het model
//
const isFullStyle: Refinement<Awv0StaticStyle, FullStyle> = (ass): ass is FullStyle => !ass.hasOwnProperty("fullLine");
export const fullStylePrism: Prism<Awv0StaticStyle, FullStyle> = new Prism(fromRefinement(isFullStyle), identity);

// Zie https://github.com/gcanti/monocle-ts/pull/62. Is gemerged. Wanneer gereleased kan dit van monocle-ts zelf komen.
function PrismFromRefinement<S, A extends S>(refinement: Refinement<S, A>) {
  return new Prism(fromRefinement(refinement), identity);
}

export namespace Image {
  export const circlePrism: Prism<ImageStyle, CircleStyle> = PrismFromRefinement(isCircle);
  export const iconPrism: Prism<ImageStyle, IconStyle> = PrismFromRefinement(isIcon);
  export const regularShapePrism: Prism<ImageStyle, RegularShapeStyle> = PrismFromRefinement(isRegularShape);
}

export namespace FullStyle {
  export const imageOptional: Optional<FullStyle, ImageStyle> = Optional.fromNullableProp("image");
  export const circleOptional: Optional<FullStyle, CircleStyle> = imageOptional.composePrism(Image.circlePrism);
  export const iconOptional: Optional<FullStyle, IconStyle> = imageOptional.composePrism(Image.iconPrism);
  export const regularShapeOptional: Optional<FullStyle, RegularShapeStyle> = imageOptional.composePrism(Image.regularShapePrism);
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
