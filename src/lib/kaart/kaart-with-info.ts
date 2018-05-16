import { none, some, Option } from "fp-ts/lib/Option";
import { List, Map, OrderedMap, Set } from "immutable";
import * as ol from "openlayers";
import { BehaviorSubject, ReplaySubject, Subject } from "rxjs";

import { TypedRecord, Zoominstellingen } from "./kaart-protocol";
import { ZoekResultaten } from "../zoeker/abstract-zoeker";
import { ZoekerCoordinator } from "../zoeker/zoeker-coordinator";
import { KaartConfig } from "./kaart-config";
import * as ke from "./kaart-elementen";
import { ModelChanger } from "./model-changes";
import { InfoBoodschap, GeselecteerdeFeatures } from "./kaart-with-info-model";
import { StyleSelector } from "./kaart-elementen";

// Spijtig genoeg kan die niet in het model zelf zitten vermits de stijl functie in de interaction.Select control wordt
// gecreëerd wanneer het model nog leeg is, en het model van dat moment in zijn scope zit. Boevendien kan de stijl op
// elk moment aangepast worden.
const STIJL_OP_LAAG = "stijlOpLaag";
const SELECTIE_STIJL_OP_LAAG = "stijlOpLaag";

export function setStyleSelector(model: KaartWithInfo, laagnaam: string, stijl: StyleSelector) {
  model.map.set(STIJL_OP_LAAG, model.map.get(STIJL_OP_LAAG).set(laagnaam, stijl));
}

export function getStyleSelector(model: KaartWithInfo, laagnaam: string): StyleSelector {
  return model.map.get(STIJL_OP_LAAG).get(laagnaam);
}

export function setSelectionStyleSelector(model: KaartWithInfo, laagnaam: string, stijl: StyleSelector) {
  model.map.set(SELECTIE_STIJL_OP_LAAG, model.map.get(SELECTIE_STIJL_OP_LAAG).set(laagnaam, stijl));
}

export function getSelectionStyleSelector(model: KaartWithInfo, laagnaam: string): StyleSelector {
  return model.map.get(SELECTIE_STIJL_OP_LAAG).get(laagnaam);
}

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
  readonly zoekerCoordinator: ZoekerCoordinator = new ZoekerCoordinator(this.zoekerSubj);
  readonly componentFoutSubj: Subject<List<string>> = new ReplaySubject<List<string>>(1);
  readonly mijnLocatieZoomDoelSubj: Subject<Option<number>> = new ReplaySubject<Option<number>>(1);
  readonly geometryChangedSubj: Subject<ol.geom.Geometry> = new Subject<ol.geom.Geometry>();
  readonly tekenSettingsSubj: BehaviorSubject<Option<ke.TekenSettings>> = new BehaviorSubject<Option<ke.TekenSettings>>(none);
  readonly infoBoodschappenSubj = new BehaviorSubject<OrderedMap<string, InfoBoodschap>>(OrderedMap());

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
    this.map.set(STIJL_OP_LAAG, Map<string, StyleSelector>());
    this.map.set(SELECTIE_STIJL_OP_LAAG, Map<string, StyleSelector>());
  }
}
