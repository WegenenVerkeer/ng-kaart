import { Function1, Function2, identity } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import { kaartLogger } from "../../kaart/log";
import * as json from "../../stijl/json-object-interpreting";
import { validationChain } from "../../util/validation";

export type ParamGetter<A> = Function2<string | A, A, A>;
export type OptionalParamGetter<A> = Function1<string | A, Option<A>>;

const parseJSON: (param: string) => json.Validation<Object> = param => {
  try {
    return json.ok(JSON.parse(param));
  } catch (e) {
    return json.fail(`'${param}' is geen JSON`);
  }
};

const getParameter: <A>(_: json.Interpreter<A>) => ParamGetter<A> = interpreter => (param, fallback) => {
  if (typeof param === "string") {
    return validationChain(parseJSON(param), interpreter).getOrElseL(() => {
      kaartLogger.warn(`Een parameter met waarde '${param}' kon niet correct geïnterpreteerd worden.`);
      return fallback;
    });
  } else {
    return param;
  }
};

export function enu<T extends string>(param: string | T, fallback: T, ...values: T[]) {
  if (typeof param === "string") {
    return json
      .enu(...values)(param)
      .getOrElseL(() => {
        kaartLogger.warn(`Een parameter met waarde '${param}' kon niet correct geïnterpreteerd worden.`);
        return fallback;
      });
  } else {
    return param;
  }
}

const getOptionalParameter: <A>(_: json.Interpreter<A>) => OptionalParamGetter<A> = interpreter => param => {
  if (typeof param === "string") {
    return validationChain(parseJSON(param), json.optional(interpreter)).getOrElseL(
      () => none // Dit kan niet omdat json.optional zelf al none returned
    );
  } else {
    return some(param);
  }
};

export const str: ParamGetter<string> = identity;

export const optStr: OptionalParamGetter<string> = param => {
  if (param) {
    return some(param);
  } else {
    return none;
  }
};

export const num: ParamGetter<number> = getParameter(json.num);
export const optNum: OptionalParamGetter<number> = getOptionalParameter(json.num);

export const bool: ParamGetter<boolean> = getParameter(json.bool);

const coordInter: json.Interpreter<ol.Coordinate> = json.arrSize(2, json.num) as json.Interpreter<ol.Coordinate>;
export const coord: ParamGetter<ol.Coordinate> = getParameter(coordInter);
export const optCoord: OptionalParamGetter<ol.Coordinate> = getOptionalParameter(coordInter);

const extentInter = json.arrSize(4, json.num) as json.Interpreter<ol.Extent>;
export const extent: ParamGetter<ol.Extent> = getParameter(extentInter);
export const optExtent: OptionalParamGetter<ol.Extent> = getOptionalParameter(extentInter);

export const stringArray: ParamGetter<string[]> = getParameter(json.arr(json.str));
