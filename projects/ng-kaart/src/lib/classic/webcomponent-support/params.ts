import { Function1, Function2, identity } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import { kaartLogger } from "../../kaart/log";
import * as json from "../../stijl/json-object-interpreting";

export type ParamGetter<A> = Function2<string | A, A, A>;
export type OptionalParamGetter<A> = Function1<string | A, Option<A>>;

const getParameter: <A>(_: json.Interpreter<A>) => ParamGetter<A> = interpreter => (param, fallback) => {
  if (typeof param === "string") {
    return interpreter(param).getOrElseL(() => {
      kaartLogger.warn(`Een parameter met waarde '${param}' kon niet correct geïnterpreteerd worden.`);
      return fallback;
    });
  } else {
    return param;
  }
};

const getOptionalParameter: <A>(_: json.Interpreter<A>) => OptionalParamGetter<A> = interpreter => param => {
  if (typeof param === "string") {
    return json
      .optional(interpreter)(param)
      .getOrElseL(
        () => none // Dit kan niet omdat json.optional zelf al none returned
      );
  } else {
    return some(param);
  }
};

export const getStringParam: ParamGetter<string> = identity;

export const getNumberParam: ParamGetter<number> = getParameter(json.num);

export const getBooleanParam: ParamGetter<boolean> = getParameter(json.bool);

const coord: json.Interpreter<ol.Coordinate> = json.arrSize(2, json.num) as json.Interpreter<ol.Coordinate>;
export const getCoordinateParam: ParamGetter<ol.Coordinate> = getParameter(coord);
export const getOptionalCoordinateParam: OptionalParamGetter<ol.Coordinate> = getOptionalParameter(coord);

const ext = json.arrSize(4, json.num) as json.Interpreter<ol.Extent>;
export const getExtentParam: ParamGetter<ol.Extent> = getParameter(ext);
export const getOptionalExtentParam: OptionalParamGetter<ol.Extent> = getOptionalParameter(ext);

export const getStringArrayParam: ParamGetter<string[]> = getParameter(json.arr(json.str));
