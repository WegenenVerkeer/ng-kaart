import { none, Option } from "fp-ts/lib/Option";
import * as MobileDetect from "mobile-detect/mobile-detect";
import * as ol from "openlayers";
import { BehaviorSubject, ReplaySubject, Subject } from "rxjs";

import { ZoekerMetPrioriteiten } from "../zoeker/zoeker";

import { KaartLocaties, WegLocatie } from "./kaart-bevragen/laaginfo.model";
import { KaartConfig } from "./kaart-config";
import * as ke from "./kaart-elementen";
import { InfoBoodschap } from "./kaart-with-info-model";
import { ModelChanger } from "./model-changes";
import { initStyleSelectorsInMap } from "./stijl-selector";
import { TileLoader } from "./tile-loader";

/**
 * Het model achter de kaartcomponent.
 */
export class KaartWithInfo {
  // Andere click tolerance op mobiel toestel (40px ipv 5px) - alternatief is detect touchscreen van modernizer, maar touch != mobile
  static readonly clickHitTolerance = new MobileDetect(window.navigator.userAgent).mobile() ? 40 : 5;

  readonly toegevoegdeLagenOpTitel: Map<string, ke.ToegevoegdeLaag> = new Map();
  readonly titelsOpGroep: Map<ke.Laaggroep, Array<string>> = new Map<ke.Laaggroep, Array<string>>([
    ["Voorgrond.Laag", []],
    ["Voorgrond.Hoog", []],
    ["Achtergrond", []],
    ["Tools", []]
  ]);
  readonly groepOpTitel: Map<string, ke.Laaggroep> = new Map();
  readonly schaal: Option<ol.control.Control> = none;
  readonly fullScreen: Option<ol.control.FullScreen> = none;
  readonly stdInteracties: Array<ol.interaction.Interaction> = [];
  readonly selectInteracties: ol.interaction.Interaction[] = [];
  readonly scrollZoomOnFocus: boolean = false;
  readonly showBackgroundSelector: boolean = false;
  readonly zoekersMetPrioriteiten: Array<ZoekerMetPrioriteiten> = Array();

  // Een serieuze doorn in het oog. Dit is een collectie die automagisch door OL up-to-date gehouden wordt (mbv interactie).
  readonly geselecteerdeFeatures: ol.Collection<ol.Feature> = new ol.Collection<ol.Feature>();
  readonly hoverFeatures: ol.Collection<ol.Feature> = new ol.Collection<ol.Feature>();
  readonly highlightedFeatures: ol.Collection<ol.Feature> = new ol.Collection<ol.Feature>();

  readonly achtergrondlaagtitelSubj: Subject<string> = new ReplaySubject<string>(1);
  readonly componentFoutSubj: Subject<Array<string>> = new ReplaySubject<Array<string>>(1);
  readonly geometryChangedSubj: Subject<ke.TekenResultaat> = new Subject<ke.TekenResultaat>();
  readonly tekenSettingsSubj: BehaviorSubject<Option<ke.TekenSettings>> = new BehaviorSubject<Option<ke.TekenSettings>>(none);
  readonly infoBoodschappenSubj = new BehaviorSubject<Map<string, InfoBoodschap>>(new Map());
  readonly publishedKaartLocatiesSubj: Subject<KaartLocaties> = new Subject();
  readonly tileLoader: TileLoader = new TileLoader();

  constructor(
    // TODO om de distinctWithInfo te versnellen zouden we als eerste element een versieteller kunnen toevoegen
    readonly config: KaartConfig,
    readonly naam: string,
    readonly container: any,
    readonly map: ol.Map,
    readonly changer: ModelChanger
  ) {
    initStyleSelectorsInMap(map);
  }
}

export const cleanup: (model: KaartWithInfo) => void = model => {
  model.map.setTarget((undefined as any) as string); // Hack omdat openlayers typedefs kaduuk zijn
};
