import * as ol from "openlayers";
// export declare namespace ol {
//   export type Color = any;
//   export type ColorLike = any;

//   namespace style {
//     // tslint:disable-next-line:no-shadowed-variable
//     export type Fill = any;
//     // tslint:disable-next-line:no-shadowed-variable
//     export type Stroke = any;
//     // tslint:disable-next-line:no-shadowed-variable
//     export type Circle = any;
//   }
// }

import { Option } from "fp-ts/lib/Option";

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

export function Text(textOptions: {
  font?: string;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  rotateWithView?: boolean;
  rotation?: number;
  text?: string;
  textAlign?: string;
  textBaseline?: string;
  fill?: ol.style.Fill;
  stroke?: ol.style.Stroke;
}): ol.style.Text {
  return new ol.style.Text(textOptions);
}

export function Style(fill: Option<ol.style.Fill>, stroke: Option<ol.style.Stroke>, image: Option<ol.style.Image>) {
  return new ol.style.Style({
    fill: fill.toUndefined(),
    stroke: stroke.toUndefined(),
    image: image.toUndefined()
  });
}
