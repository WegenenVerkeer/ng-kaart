import * as ol from "openlayers";

import { Interpreter, map, map2, map3, field, str, num, option, ok, Validation } from "./json-object-interpreting";
import * as olc from "./openlayer-constructors";

///////////////////////////////
// Openlayer types interpreters
//

interface StyleOption {
  stroke?: ol.style.Stroke;
  fill?: ol.style.Fill;
}

const fill: Interpreter<ol.style.Fill> = map(olc.Fill, option(field("color", str)));

const stroke: Interpreter<ol.style.Stroke> = map2(olc.Stroke, option(field("color", str)), option(field("width", num)));

const circle: Interpreter<ol.style.Circle> = map3(
  olc.Circle,
  option(field("radius", num)),
  option(field("fill", fill)),
  option(field("stroke", stroke))
);

export const jsonAwvV0Style: Interpreter<ol.style.Style> = map3(
  olc.Style,
  option(field("fill", fill)),
  option(field("stroke", stroke)),
  option(field("circle", circle))
);
