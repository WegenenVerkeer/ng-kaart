import { Function1, Function2, identity } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import { kaartLogger } from "../../kaart/log";
import * as ss from "../../kaart/stijl-selector";
import * as json from "../../stijl/json-object-interpreting";
import { validationChain } from "../../util/validation";

import { AwvV0StaticStyleInterpreters } from "../../stijl/json-awv-v0-stijl";
import { jsonAwvV0RuleInterpreter } from "../../stijl/json-awv-v0-stijlfunctie";

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

export function optEnu<T extends string>(param: string | Option<T>, ...values: T[]) {
  if (typeof param === "string") {
    return validationChain(parseJSON(param), json.optional(json.enu(...values))).getOrElseL(
      () => none // Dit kan niet omdat json.optional zelf al none returned
    );
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

const veldInfoInter: json.Interpreter<ke.VeldInfo> = json.interpretUndefinedRecord({
  type: json.field("type", json.enu("string", "integer", "double", "geometry", "date", "datetime", "boolean", "json")),
  naam: json.field("naam", json.str),
  label: json.field("label", json.str),
  isBasisVeld: json.field("isBasisVeld", json.bool),
  constante: json.nullable(json.field("constante", json.str)),
  template: json.nullable(json.field("template", json.str)),
  html: json.nullable(json.field("html", json.str)),
  uniekeWaarden: json.nullable(json.field("uniekeWaarden", json.arr(json.str)))
});
export const veldInfoArray: ParamGetter<ke.VeldInfo[]> = getParameter(json.arr(veldInfoInter));
export const optVeldInfoArray: OptionalParamGetter<ke.VeldInfo[]> = getOptionalParameter(json.arr(veldInfoInter));

const staticSpecInter: json.Interpreter<ss.AwvV0StyleSpec> = json.interpretUndefinedRecord({
  type: json.field("type", json.enu("StaticStyle")),
  definition: json.field("definition", AwvV0StaticStyleInterpreters.jsonAwvV0Definition)
});
const dynamicSpecInter: json.Interpreter<ss.AwvV0StyleSpec> = json.interpretUndefinedRecord({
  type: json.field("type", json.enu("DynamicStyle")),
  definition: json.field("definition", jsonAwvV0RuleInterpreter)
});

const fullSpecInter = json.byTypeDiscriminator("type", { StaticStyle: staticSpecInter, DynamicStyle: dynamicSpecInter });
export const optStyleSpec: OptionalParamGetter<ss.AwvV0StyleSpec> = getOptionalParameter(fullSpecInter);
