import { none, Option, some } from "fp-ts/lib/Option";
import { List, Map, OrderedMap } from "immutable";
import * as ol from "openlayers";
import { BehaviorSubject, ReplaySubject, Subject } from "rxjs";

import { ZoekResultaat, ZoekResultaten } from "../zoeker/abstract-zoeker";
import { ZoekerCoordinator } from "../zoeker/zoeker-coordinator";

import { KaartConfig } from "./kaart-config";
import * as ke from "./kaart-elementen";
import { Zoominstellingen } from "./kaart-protocol";
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

  readonly clickSubj: Subject<ol.Coordinate> = new Subject<ol.Coordinate>();
  readonly zoominstellingenSubj: Subject<Zoominstellingen> = new ReplaySubject<Zoominstellingen>(1);
  readonly geselecteerdeFeaturesSubj: Subject<GeselecteerdeFeatures> = new Subject<GeselecteerdeFeatures>();
  readonly geselecteerdeFeatures: ol.Collection<ol.Feature> = new ol.Collection<ol.Feature>();
  readonly middelpuntSubj: Subject<[number, number]> = new ReplaySubject<[number, number]>(1);
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

  constructor(
    // TODO om de distinctWithInfo te versnellen zouden we als eerste element een versieteller kunnen toevoegen
    readonly config: KaartConfig,
    readonly naam: string,
    readonly container: any,
    readonly map: ol.Map,
    changer: ModelChanger
  ) {
    const zetInstellingen = () => {
      // Deze mag weg wanneer alles naar changer gemigreerd is
      this.zoominstellingenSubj.next({
        zoom: map.getView().getZoom(),
        minZoom: map.getView().getMinZoom(),
        maxZoom: map.getView().getMaxZoom()
      });
      changer.zoominstellingenSubj.next({
        zoom: map.getView().getZoom(),
        minZoom: map.getView().getMinZoom(),
        maxZoom: map.getView().getMaxZoom()
      });
    };
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
    this.geselecteerdeFeatures.on("add", (event: ol.Collection.Event) =>
      this.geselecteerdeFeaturesSubj.next({
        geselecteerd: List(this.geselecteerdeFeatures.getArray()),
        toegevoegd: some(event.element),
        verwijderd: none
      })
    );
    this.geselecteerdeFeatures.on("remove", (event: ol.Collection.Event) =>
      this.geselecteerdeFeaturesSubj.next({
        geselecteerd: List(this.geselecteerdeFeatures.getArray()),
        toegevoegd: none,
        verwijderd: some(event.element)
      })
    );
    initStyleSelectorsInMap(map);
  }
}
