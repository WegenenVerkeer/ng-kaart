import * as ol from "openlayers";
import { List } from "immutable";

import * as ke from "./kaart-elementen";
import { KaartConfig } from "./kaart.config";

export class KaartWithInfo {
  constructor(
    readonly config: KaartConfig,
    readonly map: ol.Map, // de volgende parameters worden geacht niet gezet te worden initieel (brrr)
    readonly lagen: List<ke.Laag> = List<ke.Laag>(), // Het laatste element is de bovenste laag
    readonly schaal: ol.control.Control = null, // to option or not to option, that is the question?
    readonly stdInteracties: List<ol.interaction.Interaction> = List<ol.interaction.Interaction>(), // TODO beter gewoon interacties
    readonly middelpunt: ol.Coordinate = null,
    readonly zoom: number = 2
  ) {
    this.middelpunt = map.getView().getCenter();
    this.zoom = map.getView().getZoom();
  }
}
