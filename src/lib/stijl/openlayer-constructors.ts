import * as ol from "openlayers";

///////////////////////////////////////////
// Functionele constructors voor openlayers
//

export function Fill(fillOptions: {
  color?: ol.Color | ol.ColorLike; //
}): ol.style.Fill {
  return new ol.style.Fill(fillOptions);
}

export function Stroke(strokeOptions: {
  color: ol.Color | string;
  lineCap: string;
  lineJoin: string;
  lineDash: number[];
  lineDashOffset: number;
  miterLimit: number;
  width: number;
}): ol.style.Stroke {
  return new ol.style.Stroke(strokeOptions as any); // voor lineDashOffset
}

export function Circle(circleOptions: {
  radius: number; //
  fill?: ol.style.Fill;
  stroke?: ol.style.Stroke;
  snapToPixel?: boolean;
}): ol.style.Circle {
  return new ol.style.Circle(circleOptions);
}

export type TextAlign = "left" | "right" | "center" | "end" | "start";
export type TextBaseline = "bottom" | "top" | "middle" | "alphabetic" | "hanging" | "ideographic";
export type TextPlacement = "point" | "line";

export function Text(textOptions: {
  font?: string;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  rotateWithView?: boolean;
  rotation?: number;
  text?: string;
  textAlign?: TextAlign;
  textBaseline?: TextBaseline;
  placement?: TextPlacement;
  fill?: ol.style.Fill;
  stroke?: ol.style.Stroke;
}): ol.style.Text {
  return new ol.style.Text(textOptions);
}

export function Icon(iconOptions: {
  anchor?: number[];
  anchorOrigin?: ol.style.IconOrigin;
  anchorXUnits?: ol.style.IconAnchorUnits;
  anchorYUnits?: ol.style.IconAnchorUnits;
  color?: ol.Color | string;
  crossOrigin?: string;
  // img?: any | HTMLCanvasElement;
  offset?: number[];
  offsetOrigin?: ol.style.IconOrigin;
  opacity?: number;
  scale?: number;
  snapToPixel?: boolean;
  rotateWithView?: boolean;
  rotation?: number;
  size?: ol.Size;
  imgSize?: ol.Size;
  src?: string;
}): ol.style.Icon {
  return new ol.style.Icon(iconOptions);
}

export function RegularShape(regularShapeOptions: {
  fill?: ol.style.Fill;
  points: number;
  radius?: number;
  radius1?: number;
  radius2?: number;
  angle?: number;
  snapToPixel?: boolean;
  stroke?: ol.style.Stroke;
}): ol.style.RegularShape {
  return new ol.style.RegularShape(regularShapeOptions);
}

export function Style(styleOptions: {
  fill?: ol.style.Fill; //
  stroke?: ol.style.Stroke;
  text?: ol.style.Text;
  image?: ol.style.Image;
}) {
  return new ol.style.Style(styleOptions);
}
