import { Function1, Function2, identity } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import { kaartLogger } from "../../kaart/log";
import * as ss from "../../kaart/stijl-selector";
import * as json from "../../stijl/json-object-interpreting";
import { validationChain } from "../../util/validation";

import { AwvV0StaticStyleInterpreters } from "../../stijl/json-awv-v0-stijl";
import { jsonAwvV0RuleInterpreter } from "../../stijl/json-awv-v0-stijlfunctie";

/**
 * Deze hulpfuncties zijn nodig omdat de web components waarden van attributen altijd als een string doorsturen. We
 * moeten daar dus altijd converteren van een string naar het type dat we eigenlijk gezien de typeannotatie verwachten.
 * Tegelijkertijd moeten we ook overweg kunnen met waarden die wel als Javascript objecten en primitives binnen komen.
 *
 * De strategie die we gebruiken is om eerst te zien of we een string hebben en als dat zo is die te beschouwen als een
 * JSON-representatie en die dan te parsen naar het type dat we verwachten.
 *
 * Ingeval we null of undefined als waarde meegeven, zal het resultaat ook de fallbackwaarde zijn.
 */

export type ParamGetter<A> = Function2<A, A, A>;
export type OptionalParamGetter<A> = Function1<A, Option<A>>;

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
    return fromNullable(param).getOrElse(fallback);
  }
};

export function enu<T extends string>(param: string | T, fallback: T, ...values: T[]): T {
  if (typeof param === "string") {
    return json
      .enu(...values)(param)
      .getOrElseL(() => {
        kaartLogger.warn(`Een parameter met waarde '${param}' kon niet correct geïnterpreteerd worden.`);
        return fallback;
      });
  } else {
    return fromNullable(param as T).getOrElse(fallback);
  }
}

export function optEnu<T extends string>(param: string | Option<T>, ...values: T[]): Option<T> {
  if (typeof param === "string") {
    return json
      .optional(json.enu(...values))(param)
      .getOrElse(
        none // Dit kan niet omdat json.optional zelf al none returnt
      );
  } else {
    return fromNullable(param as Option<T>).getOrElse(none);
  }
}

const getOptionalParameter: <A>(_: json.Interpreter<A>) => OptionalParamGetter<A> = interpreter => param => {
  if (typeof param === "string") {
    return validationChain(parseJSON(param), json.optional(interpreter)).getOrElse(
      none // Dit kan niet omdat json.optional zelf al none returnt
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
  uniekeWaarden: json.nullable(json.field("uniekeWaarden", json.arr(json.str))),
  parseFormat: json.nullable(json.field("parseFormat", json.str)),
  displayFormat: json.nullable(json.field("displayFormat", json.str))
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
