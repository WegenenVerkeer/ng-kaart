import * as ol from "openlayers";

import { Interpreter } from "./json-object-interpreting";
import * as st from "./json-object-interpreting";
import * as olc from "./openlayer-constructors";

///////////////////////////////
// Openlayer types interpreters
//

const color: Interpreter<ol.Color | string> = st.str;

export const fill: Interpreter<ol.style.Fill> = st.mapRecord(olc.Fill, {
  color: st.optField("color", color) // ol ondersteunt meer dan enkel een string, maar wij niet
});

export const stroke: Interpreter<ol.style.Stroke> = st.mapRecord(olc.Stroke, {
  color: st.optField("color", color),
  lineCap: st.optField("lineCap", st.str),
  lineJoin: st.optField("lineJoin", st.str),
  lineDash: st.optField("lineDash", st.arr(st.num)),
  lineDashOffset: st.optField("lineDashOffset", st.num),
  miterLimit: st.optField("miterLimit", st.num),
  width: st.optField("width", st.num)
});

export const circle: Interpreter<ol.style.Circle> = st.mapRecord(olc.Circle, {
  radius: st.reqField("radius", st.num),
  fill: st.optField("fill", fill),
  stroke: st.optField("stroke", stroke),
  snapToPixel: st.optField("snapToPixel", st.bool)
});

// export const text4: Interpreter<ol.style.Text> = st.ap(
//   st.ap(st.ap(st.pure(olc.Text2))(st.optField("font", st.str))))
//   (st.optField("offsetX", st.num)))
// )(st.optField("optionY", st.num)));

const placement: Interpreter<olc.TextPlacement> = st.enu<olc.TextPlacement>("point", "line");
const textAlign: Interpreter<olc.TextAlign> = st.enu<olc.TextAlign>("left", "right", "center", "end", "start");
const textBaseline: Interpreter<olc.TextBaseline> = st.enu<olc.TextBaseline>(
  "bottom",
  "top",
  "middle",
  "alphabetic",
  "hanging",
  "ideographic"
);

export const text: Interpreter<ol.style.Text> = st.mapRecord(olc.Text, {
  font: st.optField("font", st.str),
  offsetX: st.optField("offsetX", st.num),
  offsetY: st.optField("offsetY", st.num),
  scale: st.optField("scale", st.num),
  rotateWithView: st.optField("rotateWithView", st.bool),
  rotation: st.optField("rotation", st.num),
  text: st.optField("text", st.str),
  textAlign: st.optField("textAlign", textAlign),
  textBaseline: st.optField("textBaseline", textBaseline),
  placement: st.optField("placement", placement),
  fill: st.optField("fill", fill),
  stroke: st.optField("stroke", stroke)
});

const iconOrigin: Interpreter<ol.style.IconOrigin> = st.enu<ol.style.IconOrigin>("bottom-left", "bottom-right", "top-left", "top-right");
const iconAnchorUnits: Interpreter<ol.style.IconAnchorUnits> = st.enu<ol.style.IconAnchorUnits>("fraction", "pixels");
const size: Interpreter<ol.Size> = st.arrSize(2, st.num) as Interpreter<[number, number]>;

const icon: Interpreter<ol.style.Icon> = st.mapRecord(olc.Icon, {
  anchor: st.optField("anchor", st.arr(st.num)),
  anchorOrigin: st.optField("anchorOrigin", iconOrigin),
  anchorXUnits: st.optField("anchorXUnits", iconAnchorUnits),
  anchorYUnits: st.optField("anchorYUnits", iconAnchorUnits),
  color: st.optField("color", color),
  crossOrigin: st.optField("crossOrigin", st.str),
  offset: st.optField("offset", st.arr(st.num)),
  offsetOrigin: st.optField("offsetOrigin", iconOrigin),
  opacity: st.optField("opacity", st.num),
  scale: st.optField("scale", st.num),
  snapToPixel: st.optField("snapToPixel", st.bool),
  rotateWithView: st.optField("rotateWithView", st.bool),
  rotation: st.optField("rotation", st.num),
  size: st.optField("size", size),
  imgSize: st.optField("imgSize", size),
  src: st.optField("src", st.str)
});

const regularShape: Interpreter<ol.style.RegularShape> = st.mapRecord(olc.RegularShape, {
  fill: st.optField("fill", fill),
  points: st.reqField("points", st.num),
  radius: st.optField("radius", st.num),
  radius1: st.optField("radius1", st.num),
  radius2: st.optField("radius2", st.num),
  angle: st.optField("angle", st.num),
  snapToPixel: st.optField("snapToPixel", st.bool),
  stroke: st.optField("stroke", stroke)
});

export const jsonAwvV0Style: Interpreter<ol.style.Style> = st.mapRecord(olc.Style, {
  fill: st.optField("fill", fill),
  stroke: st.optField("stroke", stroke),
  text: st.optField("text", text),
  image: st.atMostOneOf<ol.style.Image>(
    st.optField("circle", circle), //
    st.optField("icon", icon),
    st.optField("regularShape", regularShape)
  )
});
