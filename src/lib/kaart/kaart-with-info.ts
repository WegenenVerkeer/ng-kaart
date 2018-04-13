import * as ol from "openlayers";
import { List, Map } from "immutable";
import { Option, none, some } from "fp-ts/lib/Option";

import * as ke from "./kaart-elementen";
import { KaartConfig } from "./kaart-config";
import { Subject, ReplaySubject } from "rxjs";
import { Zoominstellingen, Laaggroep } from ".";

export interface Groeplagen {
  readonly laaggroep: Laaggroep;
  readonly lagen: List<ke.Laag>;
}

/**
 * Het model achter de kaartcomponent.
 */
export class KaartWithInfo {
  readonly olLayersOpTitel: Map<string, ol.layer.Base> = Map();
  readonly titelsOpGroep: Map<Laaggroep, List<string>> = Map([["Voorgrond", List()], ["Achtergrond", List()], ["Tools", List()]]);
  readonly groepOpTitel: Map<string, Laaggroep> = Map();
  readonly lagen: List<ke.Laag> = List();
  readonly schaal: Option<ol.control.Control> = none;
  readonly fullScreen: Option<ol.control.FullScreen> = none;
  readonly stdInteracties: List<ol.interaction.Interaction> = List(); // TODO beter gewoon interacties
  readonly scrollZoomOnFocus: boolean = false;
  readonly showBackgroundSelector: boolean = false;
  readonly zoominstellingenSubj: Subject<Zoominstellingen> = new ReplaySubject<Zoominstellingen>(1);
  readonly middelpuntSubj: Subject<[number, number]> = new ReplaySubject<[number, number]>(1);
  readonly achtergrondlaagtitelSubj: Subject<string> = new ReplaySubject<string>(1);
  readonly groeplagenSubj: Subject<Groeplagen> = new ReplaySubject<Groeplagen>(1);
  readonly componentFoutSubj: Subject<List<string>> = new ReplaySubject<List<string>>(1);
  readonly geometryChangedSubj: Subject<ol.geom.Geometry> = new Subject<ol.geom.Geometry>();
  readonly metenLengteOppervlakteSubj: Subject<boolean> = new ReplaySubject<boolean>(1);

  constructor(
    // TODO om de distinctWithInfo te versnellen zouden we als eerste element een versieteller kunnen toevoegen
    readonly config: KaartConfig,
    readonly naam: string,
    readonly container: any,
    readonly map: ol.Map
  ) {
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
