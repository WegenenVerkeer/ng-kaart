import { Function1, identity, Refinement } from "fp-ts/lib/function";
import { fromRefinement } from "fp-ts/lib/Option";
import { Lens, Optional, Prism } from "monocle-ts";

import { Kleur, kleurcodeValue, stringToKleur } from "./colour";

// De typedefinities hierna beschrijven de JSON-DSL voor static styles die we op dit moment ondersteunen.

export type AwvV0StaticStyle = FullStyle;

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
  circle?: CircleStyle;
  icon?: IconStyle;
  regularShape?: RegularShapeStyle;
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
  const base = {
    fill: rec.fill,
    stroke: rec.stroke,
    text: rec.text
  };
  if (rec.image) {
    if (isCircle(rec.image)) {
      return { ...base, circle: rec.image };
    }
    if (isIcon(rec.image)) {
      return { ...base, icon: rec.image };
    }
    if (isRegularShape(rec.image)) {
      return { ...base, regularShape: rec.image };
    }
  }
  return base;
}

/////////////////////////////////////////
// Manipulatie en inspectie van het model
//
const isFullStyle: Refinement<AwvV0StaticStyle, FullStyle> = (ass): ass is FullStyle => !ass.hasOwnProperty("fullLine");
export const fullStylePrism: Prism<AwvV0StaticStyle, FullStyle> = new Prism(fromRefinement(isFullStyle), identity);

export namespace Image {
  export const circlePrism: Prism<ImageStyle, CircleStyle> = Prism.fromRefinement(isCircle);
  export const iconPrism: Prism<ImageStyle, IconStyle> = Prism.fromRefinement(isIcon);
  export const regularShapePrism: Prism<ImageStyle, RegularShapeStyle> = Prism.fromRefinement(isRegularShape);
}

export namespace FullStyle {
  export const strokeOptional: Optional<FullStyle, StrokeStyle> = Optional.fromNullableProp("stroke");
  export const circleOptional: Optional<FullStyle, CircleStyle> = Optional.fromNullableProp("circle");
  export const iconOptional: Optional<FullStyle, IconStyle> = Optional.fromNullableProp("icon");
  export const regularShapeOptional: Optional<FullStyle, RegularShapeStyle> = Optional.fromNullableProp("regularShape");
}

export namespace Circle {
  export const fillOptional: Optional<CircleStyle, FillStyle> = Optional.fromNullableProp("fill");
}

export namespace Fill {
  export const colorLens: Lens<FillStyle, ColorType> = Lens.fromProp("color");
}

export namespace Stroke {
  export const colorOptional: Optional<StrokeStyle, ColorType> = Optional.fromNullableProp("color");
}

export namespace Color {
  // Merk op dat deze effectief de opgeslagen string omzet naar een Kleur. Dat faalt wanneer de kleur niet een van de bekende kleuren is,
  // maar dat is geen probleem voor onze huidige use cases. Evt. kan er een kleurLens gemaakt worden die nooit faalt (door meer te
  // aanvaarden en/of een fallback te gebruiken).
  export const kleurOptional: Optional<ColorType, Kleur> = new Optional(stringToKleur, kleur => () => kleurcodeValue(kleur));
}
