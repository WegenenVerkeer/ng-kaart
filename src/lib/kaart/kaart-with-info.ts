import { none, Option } from "fp-ts/lib/Option";
import { List, Map } from "immutable";
import * as ol from "openlayers";
import { BehaviorSubject, ReplaySubject, Subject } from "rxjs";

import { Laaggroep, Zoominstellingen } from ".";
import { ZoekResultaten } from "../zoeker/abstract-zoeker";
import { ZoekerCoordinator } from "../zoeker/zoeker-coordinator";
import { KaartConfig } from "./kaart-config";
import * as ke from "./kaart-elementen";
import { InfoBoodschap } from "./info-boodschap";

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
  readonly clickSubj: Subject<ol.Coordinate> = new Subject<ol.Coordinate>();
  readonly zoominstellingenSubj: Subject<Zoominstellingen> = new ReplaySubject<Zoominstellingen>(1);
  readonly geselecteerdeFeaturesSubj: Subject<List<ol.Feature>> = new ReplaySubject<List<ol.Feature>>(1);
  readonly geselecteerdeFeatures: ol.Collection<ol.Feature> = new ol.Collection<ol.Feature>();
  readonly middelpuntSubj: Subject<[number, number]> = new ReplaySubject<[number, number]>(1);
  readonly achtergrondlaagtitelSubj: Subject<string> = new ReplaySubject<string>(1);
  readonly groeplagenSubj: Subject<Groeplagen> = new ReplaySubject<Groeplagen>(100);
  readonly zoekerSubj: Subject<ZoekResultaten> = new ReplaySubject<ZoekResultaten>(1);
  readonly componentFoutSubj: Subject<List<string>> = new ReplaySubject<List<string>>(1);
  readonly zoekerCoordinator: ZoekerCoordinator = new ZoekerCoordinator(this.zoekerSubj);
  readonly mijnLocatieZoomDoelSubj: Subject<Option<number>> = new ReplaySubject<Option<number>>(1);
  readonly geometryChangedSubj: Subject<ol.geom.Geometry> = new Subject<ol.geom.Geometry>();
  readonly infoBoodschappenSubj: BehaviorSubject<Map<string, InfoBoodschap>> = new BehaviorSubject<Map<string, InfoBoodschap>>(Map());
  readonly tekenSettingsSubj: BehaviorSubject<Option<ke.TekenSettings>> = new BehaviorSubject<Option<ke.TekenSettings>>(none);

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
    map.on("click", (event: ol.MapBrowserEvent) => {
      return this.clickSubj.next(event.coordinate);
    });
    this.geselecteerdeFeatures.on("add", () => {
      this.geselecteerdeFeaturesSubj.next(List(this.geselecteerdeFeatures.getArray()));
    });
    this.geselecteerdeFeatures.on("remove", () => {
      this.geselecteerdeFeaturesSubj.next(List(this.geselecteerdeFeatures.getArray()));
    });
  }
}
