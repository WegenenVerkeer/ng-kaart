import * as json from "../stijl/json-object-interpreting";
import { Consumer } from "../util/function";

function applySuccess<T>(validation: json.Validation<T>, effect: Consumer<T>): void {
  validation.bimap(() => 1, effect);
}

function onlyWhenString<T>(param: string | T, interpreter: json.Interpreter<T>, effect: Consumer<T>) {
  if (typeof param === "string") {
    applySuccess(interpreter(JSON.parse(param)), effect);
  } else {
    effect(param);
  }
}

export function extent(param: string | ol.Extent, effect: Consumer<ol.Extent>): void {
  onlyWhenString(param, json.arrSize(4, json.num), effect);
}

export function coord(param: string | ol.Coordinate, effect: Consumer<ol.Coordinate>): void {
  onlyWhenString(param, json.arrSize(2, json.num), effect);
}

export function stringArray(param: string | string[], effect: Consumer<string[]>): void {
  onlyWhenString(param, json.arr(json.str), effect);
}

export function bool(param: string | boolean, effect: Consumer<boolean>): void {
  onlyWhenString(param, json.bool, effect);
}

export function num(param: string | number, effect: Consumer<number>): void {
  onlyWhenString(param, json.num, effect);
}

export function enu<T extends string>(param: string | T, effect: Consumer<T>, ...values: T[]): void {
  onlyWhenString(param, json.enu(...values), effect);
}
