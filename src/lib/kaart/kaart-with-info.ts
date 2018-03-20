import * as ol from "openlayers";
import { List, Map } from "immutable";
import { Option, none, some } from "fp-ts/lib/Option";

import * as ke from "./kaart-elementen";
import { KaartConfig } from "./kaart-config";
import { Subject, ReplaySubject } from "rxjs";
import { Zoominstellingen } from ".";

/**
 * Het model achter de kaartcomponent.
 */
export class KaartWithInfo {
  constructor(
    // TODO om de distinctWithInfo te versnellen zouden we als eerste element een versieteller kunnen toevoegen
    readonly config: KaartConfig,
    readonly naam: string,
    readonly container: any,
    readonly map: ol.Map, // de volgende parameters worden geacht niet gezet te worden initieel (brrr)
    readonly olLayersOpTitel: Map<string, ol.layer.Base> = Map(),
    readonly lagen: List<ke.Laag> = List(),
    readonly schaal: Option<ol.control.Control> = none,
    readonly fullScreen: Option<ol.control.FullScreen> = none,
    readonly stdInteracties: List<ol.interaction.Interaction> = List(), // TODO beter gewoon interacties
    readonly middelpunt: Option<ol.Coordinate> = none,
    readonly zoom: number = -1,
    readonly maxZoom: number = -1,
    readonly minZoom: number = -1,
    readonly extent: Option<ol.Extent> = none,
    readonly size: Option<[number, number]> = none,
    readonly scrollZoomOnFocus = false,
    readonly showBackgroundSelector = false,
    readonly possibleBackgrounds: List<ke.WmsLaag | ke.BlancoLaag> = List(), // TODO mag weg
    readonly achtergrondlaagtitel: Option<string> = none, // TODO mag weg
    readonly achtergrondLayer: Option<ol.layer.Base> = none,
    readonly zoominstellingenSubj: Subject<Zoominstellingen> = new ReplaySubject<Zoominstellingen>(1),
    readonly middelpuntSubj: Subject<[number, number]> = new ReplaySubject<[number, number]>(1),
    readonly achtergrondlaagtitelSubj: Subject<string> = new ReplaySubject<string>(1)
  ) {
    this.middelpunt = some(map.getView().getCenter());
    this.zoom = map.getView().getZoom();
    this.maxZoom = map.getView().getMaxZoom();
    this.minZoom = map.getView().getMinZoom();
    this.extent = some(map.getView().calculateExtent(map.getSize()));
    this.size = some(map.getSize());
    const zetInstellingen = () =>
      this.zoominstellingenSubj.next({
        zoom: map.getView().getZoom(),
        minZoom: map.getView().getMinZoom(),
        maxZoom: map.getView().getMaxZoom()
      });
    map.getView().on("change:resolution", () => {
      const zoomNiveau = map.getView().getZoom();
      // OL genereert een heleboel tussenliggende zooms tijden het animeren.
      if (Number.isInteger(zoomNiveau)) {
        zetInstellingen();
      }
    });
    map.getLayers().on("change:length", zetInstellingen);
    map.getView().on("change:center", () => this.middelpuntSubj.next(map.getView().getCenter()));
  }
}
