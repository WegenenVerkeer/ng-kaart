import { Function1, identity } from "fp-ts/lib/function";

import * as ol from "../util/openlayers-compat";

import { Interpreter } from "./json-object-interpreting";
import * as st from "./json-object-interpreting";
import * as ss from "./stijl-static-types";
import { ImageStyle, SizeType } from "./stijl-static-types";

/// ////////////////////////////
// Openlayer types interpreters
//

export const jsonAwvV0Style: Interpreter<ol.style.Style> = (style) =>
  AwvV0StaticStyleInterpreters.jsonAwvV0Definition(style).map(
    StaticStyleEncoders.awvV0Style.encode
  );

export const jsonAwvV0Definition: Interpreter<ol.style.Style> = st.field(
  "definition",
  jsonAwvV0Style
);

/// //////////////////////////////////////////////////////////////
// Interpreters voor gedeserialiseerde JSON naar AwvV0StaticStyle
//

export namespace AwvV0StaticStyleInterpreters {
  const colorStyle: Interpreter<ss.ColorType> = st.str;

  const fillStyle: Interpreter<ss.FillStyle> = st.interpretRecord({
    color: st.field("color", colorStyle), // ol ondersteunt meer dan enkel een string, maar wij niet
  });

  const lineCap: Interpreter<CanvasLineCap> = st.enu<CanvasLineCap>(
    "butt",
    "round",
    "square"
  );

  const lineJoin: Interpreter<CanvasLineJoin> = st.enu<CanvasLineJoin>(
    "bevel",
    "miter",
    "round"
  );

  const strokeStyle: Interpreter<ss.StrokeStyle> = st.interpretUndefinedRecord({
    color: st.undefField("color", colorStyle),
    lineCap: st.undefField("lineCap", lineCap),
    lineJoin: st.undefField("lineJoin", lineJoin),
    lineDash: st.undefField("lineDash", st.arr(st.num)),
    lineDashOffset: st.undefField("lineDashOffset", st.num),
    miterLimit: st.undefField("miterLimit", st.num),
    width: st.undefField("width", st.num),
  });

  const circleStyle: Interpreter<ss.CircleStyle> = st.interpretUndefinedRecord({
    radius: st.field("radius", st.num),
    fill: st.undefField("fill", fillStyle),
    stroke: st.undefField("stroke", strokeStyle),
  });

  const placement: Interpreter<ss.TextPlacementType> = st.enu<
    ss.TextPlacementType
  >("point", "line");
  const textAlign: Interpreter<ss.TextAlignType> = st.enu<ss.TextAlignType>(
    "left",
    "right",
    "center",
    "end",
    "start"
  );
  const textBaseline: Interpreter<ss.TextBaselineType> = st.enu<
    ss.TextBaselineType
  >("bottom", "top", "middle", "alphabetic", "hanging", "ideographic");

  const textStyle: Interpreter<ss.TextStyle> = st.interpretUndefinedRecord({
    font: st.undefField("font", st.str),
    offsetX: st.undefField("offsetX", st.num),
    offsetY: st.undefField("offsetY", st.num),
    scale: st.undefField("scale", st.num),
    rotateWithView: st.undefField("rotateWithView", st.bool),
    rotation: st.undefField("rotation", st.num),
    text: st.undefField("text", st.str),
    textAlign: st.undefField("textAlign", textAlign),
    textBaseline: st.undefField("textBaseline", textBaseline),
    placement: st.undefField("placement", placement),
    fill: st.undefField("fill", fillStyle),
    stroke: st.undefField("stroke", strokeStyle),
  });

  const iconOrigin: Interpreter<ol.style.IconOrigin> = st.enu<
    ol.style.IconOrigin
  >(
    ol.style.IconOrigin.BOTTOM_LEFT,
    ol.style.IconOrigin.BOTTOM_RIGHT,
    ol.style.IconOrigin.TOP_LEFT,
    ol.style.IconOrigin.TOP_RIGHT
  );
  const iconAnchorUnits: Interpreter<ol.style.IconAnchorUnits> = st.enu<
    ol.style.IconAnchorUnits
  >(ol.style.IconAnchorUnits.FRACTION, ol.style.IconAnchorUnits.PIXELS);
  const size: Interpreter<SizeType> = st.arrSize(2, st.num) as Interpreter<
    [number, number]
  >;

  const iconStyle: Interpreter<ss.IconStyle> = st.interpretUndefinedRecord({
    anchor: st.undefField("anchor", st.arr(st.num)),
    anchorOrigin: st.undefField("anchorOrigin", iconOrigin),
    anchorXUnits: st.undefField("anchorXUnits", iconAnchorUnits),
    anchorYUnits: st.undefField("anchorYUnits", iconAnchorUnits),
    color: st.undefField("color", colorStyle),
    crossOrigin: st.undefField("crossOrigin", st.str),
    offset: st.undefField("offset", st.arr(st.num)),
    offsetOrigin: st.undefField("offsetOrigin", iconOrigin),
    opacity: st.undefField("opacity", st.num),
    scale: st.undefField("scale", st.num),
    rotateWithView: st.undefField("rotateWithView", st.bool),
    rotation: st.undefField("rotation", st.num),
    size: st.undefField("size", size),
    imgSize: st.undefField("imgSize", size),
    src: st.undefField("src", st.str),
  });

  const regularShapeStyle: Interpreter<ss.RegularShapeStyle> = st.interpretUndefinedRecord(
    {
      points: st.undefField("points", st.num),
      fill: st.undefField("fill", fillStyle),
      radius: st.undefField("radius", st.num),
      radius1: st.undefField("radius1", st.num),
      radius2: st.undefField("radius2", st.num),
      angle: st.undefField("angle", st.num),
      stroke: st.undefField("stroke", strokeStyle),
    }
  );

  export const fullStyle: Interpreter<ss.FullStyle> = st.mapRecord(
    ss.FullStyle,
    {
      fill: st.undefField("fill", fillStyle),
      stroke: st.undefField("stroke", strokeStyle),
      text: st.undefField("text", textStyle),
      image: st.atMostOneDefined<ss.ImageStyle>(
        st.undefField("circle", circleStyle),
        st.undefField("icon", iconStyle),
        st.undefField("regularShape", regularShapeStyle)
      ),
    }
  );

  export const jsonAwvV0Definition: Interpreter<ss.AwvV0StaticStyle> = fullStyle;
}

/// //////////////////////////////////////////////////////////
// Encoder voor (gevalideerde) AwvV0StaticStyle naar OL Style
//

export namespace StaticStyleEncoders {
  export interface Encoder<I, O> {
    encode: Function1<I, O>;
  }

  const Color: Encoder<string, string | ol.Color> = {
    encode: identity,
  };

  const Fill: Encoder<ss.FillStyle, ol.style.Fill> = {
    encode: (fill) =>
      new ol.style.Fill({
        color: Color.encode(fill.color),
      }),
  };

  const Stroke: Encoder<ss.StrokeStyle, ol.style.Stroke> = {
    encode: (stroke) =>
      new ol.style.Stroke({
        color: stroke.color && Color.encode(stroke.color),
        lineCap: stroke.lineCap,
        lineDash: stroke.lineDash,
        lineJoin: stroke.lineJoin,
        miterLimit: stroke.miterLimit,
        width: stroke.width,
      }),
  };

  const Text: Encoder<ss.TextStyle, ol.style.Text> = {
    encode: (text) =>
      new ol.style.Text({
        font: text.font,
        offsetX: text.offsetX,
        offsetY: text.offsetY,
        scale: text.scale,
        rotateWithView: text.rotateWithView,
        rotation: text.rotation,
        text: text.text,
        textAlign: text.textAlign,
        textBaseline: text.textBaseline,
        placement: text.placement,
        fill: text.fill && Fill.encode(text.fill),
        stroke: text.stroke && Stroke.encode(text.stroke),
      }),
  };

  const Circle: Encoder<ss.CircleStyle, ol.style.Circle> = {
    encode: (circle) =>
      new ol.style.Circle({
        radius: circle.radius,
        fill: circle.fill && Fill.encode(circle.fill),
        stroke: circle.stroke && Stroke.encode(circle.stroke),
      }),
  };

  // enum naar enum
  const toIconOrigin = (
    iconOrigin: ss.IconOriginType | undefined
  ): ol.style.IconOrigin | undefined => {
    if (iconOrigin === undefined) {
      return undefined;
    }
    switch (iconOrigin) {
      case "bottom-left":
        return ol.style.IconOrigin.BOTTOM_LEFT;
      case "bottom-right":
        return ol.style.IconOrigin.BOTTOM_RIGHT;
      case "top-left":
        return ol.style.IconOrigin.TOP_LEFT;
      case "top-right":
        return ol.style.IconOrigin.TOP_RIGHT;
    }
  };

  const toIconAnchorUnits = (
    anchorUnits: ss.IconAnchorUnitsType | undefined
  ): ol.style.IconAnchorUnits | undefined => {
    if (anchorUnits === undefined) {
      return undefined;
    }
    switch (anchorUnits) {
      case "fraction":
        return ol.style.IconAnchorUnits.FRACTION;
      case "pixels":
        return ol.style.IconAnchorUnits.PIXELS;
    }
  };

  const Icon: Encoder<ss.IconStyle, ol.style.Icon> = {
    encode: (icon) =>
      new ol.style.Icon({
        anchor: icon.anchor,
        anchorOrigin: toIconOrigin(icon.anchorOrigin),
        anchorXUnits: toIconAnchorUnits(icon.anchorXUnits),
        anchorYUnits: toIconAnchorUnits(icon.anchorYUnits),
        color: icon.color && Color.encode(icon.color),
        crossOrigin: icon.crossOrigin,
        offset: icon.offset,
        offsetOrigin: toIconOrigin(icon.offsetOrigin),
        opacity: icon.opacity,
        scale: icon.scale,
        rotateWithView: icon.rotateWithView,
        rotation: icon.rotation,
        size: icon.size,
        imgSize: icon.imgSize,
        src: icon.src,
      }),
  };

  const RegularShape: Encoder<ss.RegularShapeStyle, ol.style.RegularShape> = {
    encode: (regularShape) =>
      new ol.style.RegularShape({
        fill: regularShape.fill && Fill.encode(regularShape.fill),
        stroke: regularShape.stroke && Stroke.encode(regularShape.stroke),
        radius: regularShape.radius,
        radius1: regularShape.radius1,
        radius2: regularShape.radius2,
        angle: regularShape.angle,
        points: regularShape.points,
      }),
  };

  const Image: Encoder<ss.ImageStyle, ol.style.Image> = {
    encode: (image) =>
      ss.matchImageStyle<ol.style.Image>(
        image,
        Circle.encode,
        Icon.encode,
        RegularShape.encode
      ),
  };

  const FullStyle: Encoder<ss.FullStyle, ol.style.Style> = {
    encode: (fs) => {
      const image: ImageStyle | undefined =
        fs.circle || fs.icon || fs.regularShape;
      return new ol.style.Style({
        fill: fs.fill && Fill.encode(fs.fill),
        stroke: fs.stroke && Stroke.encode(fs.stroke),
        text: fs.text && Text.encode(fs.text),
        image: image && Image.encode(image),
      });
    },
  };

  export const awvV0Style = FullStyle;
}
