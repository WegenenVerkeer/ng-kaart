import * as ol from "openlayers";
import { Option } from "fp-ts/lib/Option";

///////////////////////////////////////////
// Functionele constructors voor openlayers
//

export function Fill(color: Option<ol.Color | ol.ColorLike>): ol.style.Fill {
  return new ol.style.Fill({
    color: color.toUndefined()
  });
}

export function Stroke(color: Option<ol.Color | string>, width: Option<number>): ol.style.Stroke {
  return new ol.style.Stroke({
    color: color.toUndefined(),
    width: width.toUndefined()
  });
}

export function Circle(radius: Option<number>, fill: Option<ol.style.Fill>, stroke: Option<ol.style.Stroke>): ol.style.Circle {
  return new ol.style.Circle({
    radius: radius.toNullable(),
    stroke: stroke.toNullable(),
    fill: fill.toNullable()
  });
}

export function Style(fill: Option<ol.style.Fill>, stroke: Option<ol.style.Stroke>, image: Option<ol.style.Image>) {
  return new ol.style.Style({
    fill: fill.toNullable(),
    stroke: stroke.toNullable(),
    image: image.toNullable()
  });
}
