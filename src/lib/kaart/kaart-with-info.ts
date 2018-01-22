import * as ol from "openlayers";
import { List, Map } from "immutable";

import * as ke from "./kaart-elementen";
import { KaartConfig } from "./kaart.config";

export class KaartWithInfo {
  constructor(
    readonly config: KaartConfig,
    readonly naam: String,
    readonly container: any,
    readonly map: ol.Map, // de volgende parameters worden geacht niet gezet te worden initieel (brrr)
    readonly lagenOpTitel: Map<string, ol.layer.Base> = Map(),
    readonly schaal: ol.control.Control = null, // to option or not to option, that is the question?
    readonly fullScreen: ol.control.FullScreen = null, // to option or not to option, that is the question?
    readonly stdInteracties: List<ol.interaction.Interaction> = List<ol.interaction.Interaction>(), // TODO beter gewoon interacties
    readonly middelpunt: ol.Coordinate = null,
    readonly zoom: number = null,
    readonly extent: ol.Extent = null,
    readonly size: [number, number] = null,
    readonly scrollZoomOnFocus = false
  ) {
    this.middelpunt = map.getView().getCenter();
    this.zoom = map.getView().getZoom();
    this.extent = map.getView().calculateExtent(map.getSize());
    this.size = map.getSize();
  }
}
