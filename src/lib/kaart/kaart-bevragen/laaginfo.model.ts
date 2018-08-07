import * as ol from "openlayers";
import * as rx from "rxjs";

export type LaagLocationInfo = TextLaagLocationInfo;

export interface TextLaagLocationInfo {
  readonly type: "TextLaagLocationInfo";
  readonly text: string;
}

export interface LaagLocationInfoService {
  infoByLocation$(location: ol.Coordinate): rx.Observable<LaagLocationInfo>;
}

export const TextLaagLocationInfo: (_: string) => TextLaagLocationInfo = text => ({ type: "TextLaagLocationInfo", text: text });
