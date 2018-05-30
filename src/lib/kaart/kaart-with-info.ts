import { none, Option, some } from "fp-ts/lib/Option";
import { List, Map, OrderedMap } from "immutable";
import * as ol from "openlayers";
import { BehaviorSubject, Observable, ReplaySubject, Subject } from "rxjs";
import { debounceTime, map as rxmap, merge, shareReplay } from "rxjs/operators";

import { observableFromOlEvent } from "../util/ol-observable";
import { ZoekResultaat, ZoekResultaten } from "../zoeker/zoeker-base";
import { ZoekerCoordinator } from "../zoeker/zoeker-coordinator";

import { KaartConfig } from "./kaart-config";
import * as ke from "./kaart-elementen";
import { GeselecteerdeFeatures, InfoBoodschap } from "./kaart-with-info-model";
import { ModelChanger } from "./model-changes";
import { initStyleSelectorsInMap } from "./stijl-selector";
import { TileLoader } from "./tile-loader";

/**
 * Het model achter de kaartcomponent.
 */
export class KaartWithInfo {
  readonly toegevoegdeLagenOpTitel: Map<string, ke.ToegevoegdeLaag> = Map();
  readonly titelsOpGroep: Map<ke.Laaggroep, List<string>> = Map([
    ["Voorgrond.Laag", List()],
    ["Voorgrond.Hoog", List()],
    ["Achtergrond", List()],
    ["Tools", List()]
  ]);
  readonly groepOpTitel: Map<string, ke.Laaggroep> = Map();
  // readonly lagen: List<ke.ToegevoegdeLaag> = List();
  readonly schaal: Option<ol.control.Control> = none;
  readonly fullScreen: Option<ol.control.FullScreen> = none;
  readonly stdInteracties: List<ol.interaction.Interaction> = List(); // TODO beter gewoon interacties
  readonly scrollZoomOnFocus: boolean = false;
  readonly showBackgroundSelector: boolean = false;

  // Een serieuze doorn in het oog. Dit is een collectie die automagisch door OL up-to-date gehouden wordt (mbv interactie).
  readonly geselecteerdeFeatures: ol.Collection<ol.Feature> = new ol.Collection<ol.Feature>();

  readonly clickSubj: Subject<ol.Coordinate> = new Subject<ol.Coordinate>();
  readonly achtergrondlaagtitelSubj: Subject<string> = new ReplaySubject<string>(1);
  readonly zoekerSubj: Subject<ZoekResultaten> = new ReplaySubject<ZoekResultaten>(1);
  readonly zoekerKlikSubj: Subject<ZoekResultaat> = new ReplaySubject<ZoekResultaat>(1);
  readonly zoekerCoordinator: ZoekerCoordinator = new ZoekerCoordinator(this.zoekerSubj, this.zoekerKlikSubj);
  readonly componentFoutSubj: Subject<List<string>> = new ReplaySubject<List<string>>(1);
  readonly mijnLocatieZoomDoelSubj: Subject<Option<number>> = new ReplaySubject<Option<number>>(1);
  readonly geometryChangedSubj: Subject<ol.geom.Geometry> = new Subject<ol.geom.Geometry>();
  readonly tekenSettingsSubj: BehaviorSubject<Option<ke.TekenSettings>> = new BehaviorSubject<Option<ke.TekenSettings>>(none);
  readonly infoBoodschappenSubj = new BehaviorSubject<OrderedMap<string, InfoBoodschap>>(OrderedMap());
  readonly tileLoader: TileLoader = new TileLoader();

  readonly kickViewSubj: (x) => void; // beetje rare constructie omwille van removeEventListener

  constructor(
    // TODO om de distinctWithInfo te versnellen zouden we als eerste element een versieteller kunnen toevoegen
    readonly config: KaartConfig,
    readonly naam: string,
    readonly container: any,
    readonly map: ol.Map,
    readonly changer: ModelChanger
  ) {
    this.kickViewSubj = () => this.changer.viewSubj.next(this.map);
    map.getView().on("change:resolution", () => {
      const zoomNiveau = map.getView().getZoom();
      // OL genereert een heleboel tussenliggende zooms tijden het animeren.
      if (Number.isInteger(zoomNiveau)) {
        this.kickViewSubj("zoom");
      }
    });
    map.getLayers().on("change:length", this.kickViewSubj);
    map.getView().on("change:center", this.kickViewSubj);
    window.addEventListener("resize", this.kickViewSubj);
    map.on("click", (event: ol.MapBrowserEvent) => {
      return this.clickSubj.next(event.coordinate);
    });

    initStyleSelectorsInMap(map);
  }
}

export const cleanup: (model: KaartWithInfo) => void = model => {
  window.removeEventListener("resize", model.kickViewSubj);
  model.map.setTarget((undefined as any) as string); // Hack omdat openlayers typedefs kaduuk zijn
};
