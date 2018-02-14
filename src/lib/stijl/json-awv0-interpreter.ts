import * as ol from "openlayers";

import { Interpreter } from "./json-object-interpreting";
import * as st from "./json-object-interpreting";
import * as olc from "./openlayer-constructors";

///////////////////////////////
// Openlayer types interpreters
//

interface StyleOption {
  stroke?: ol.style.Stroke;
  fill?: ol.style.Fill;
}

const fill: Interpreter<ol.style.Fill> = st.mapRecord(olc.Fill, {
  color: st.optField("color", st.str) // ol ondersteunt meer dan enkel een string, maar wij niet
});

const stroke: Interpreter<ol.style.Stroke> = st.mapRecord(olc.Stroke, {
  color: st.optField("color", st.str),
  lineCap: st.optField("lineCap", st.str),
  lineJoin: st.optField("lineJoin", st.str),
  lineDash: st.optField("lineDash", st.arr(st.num)),
  lineDashOffset: st.optField("lineDashOffset", st.num),
  miterLimit: st.optField("miterLimit", st.num),
  width: st.optField("width", st.num)
});

export const circle: Interpreter<ol.style.Circle> = st.mapRecord(olc.Circle, {
  radius: st.required(st.field("radius", st.num)),
  fill: st.optField("fill", fill),
  stroke: st.optField("stroke", stroke),
  snapToPixel: st.optField("snapToPixel", st.bool)
});

// export const text4: Interpreter<ol.style.Text> = st.ap(
//   st.ap(st.ap(st.pure(olc.Text2))(st.optField("font", st.str))))
//   (st.optField("offsetX", st.num)))
// )(st.optField("optionY", st.num)));

export const text: Interpreter<ol.style.Text> = st.mapRecord(olc.Text, {
  font: st.optField("font", st.str),
  offsetX: st.optField("offsetX", st.num),
  offsetY: st.optField("offsetY", st.num),
  scale: st.optField("scale", st.num),
  rotateWithView: st.optField("rotateWithView", st.bool),
  rotation: st.optField("rotation", st.num),
  text: st.optField("text", st.str),
  textAlign: st.optField("textAlign", st.str),
  textBaseline: st.optField("textBaseline", st.str),
  fill: st.optField("fill", fill),
  stroke: st.optField("stroke", stroke)
});

export const jsonAwvV0Style: Interpreter<ol.style.Style> = st.map3(
  olc.Style,
  st.optField("fill", fill),
  st.optField("stroke", stroke),
  st.optField("circle", circle)
);

interface FillOptions {
  color?: ol.Color | ol.ColorLike;
}
