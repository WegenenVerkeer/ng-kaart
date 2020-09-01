import { option } from "fp-ts";
import { BehaviorSubject, ReplaySubject, Subject } from "rxjs";

import * as ol from "../util/openlayers-compat";
import { ZoekerMetWeergaveopties } from "../zoeker/zoeker";

import { KaartLocaties } from "./kaart-bevragen/laaginfo.model";
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
  readonly toegevoegdeLagenOpTitel: Map<string, ke.ToegevoegdeLaag> = new Map();
  readonly titelsOpGroep: Map<ke.Laaggroep, Array<string>> = new Map<
    ke.Laaggroep,
    Array<string>
  >([
    ["Voorgrond.Laag", []],
    ["Voorgrond.Hoog", []],
    ["Achtergrond", []],
    ["Tools", []],
  ]);
  readonly groepOpTitel: Map<string, ke.Laaggroep> = new Map();
  readonly schaal: option.Option<ol.control.Control> = option.none;
  readonly fullScreen: option.Option<ol.control.FullScreen> = option.none;
  readonly stdInteracties: ol.interaction.Interaction[] = [];
  readonly selectInteracties: ol.interaction.Interaction[] = [];
  readonly hoverInteractie: option.Option<ol.interaction.Interaction> =
    option.none;
  readonly highlightInteractie: option.Option<ol.interaction.Interaction> =
    option.none;
  readonly scrollZoomOnFocus: boolean = false;
  readonly showBackgroundSelector: boolean = false;
  readonly zoekersMetPrioriteiten: ZoekerMetWeergaveopties[] = [];

  // Een serieuze doorn in het oog. Dit is een collectie die automagisch door OL up-to-date gehouden wordt (mbv interactie).
  readonly geselecteerdeFeatures: ol.Collection<ol.Feature> = new ol.Collection<
    ol.Feature
  >();

  readonly hoverFeatures: ol.Collection<ol.Feature> = new ol.Collection<
    ol.Feature
  >();
  readonly highlightedFeatures: ol.Collection<ol.Feature> = new ol.Collection<
    ol.Feature
  >();

  readonly achtergrondlaagtitelSubj: Subject<string> = new ReplaySubject<
    string
  >(1);
  readonly meldingenSubj: Subject<Array<string>> = new ReplaySubject<
    Array<string>
  >(1);
  readonly geometryChangedSubj: Subject<ke.Tekenresultaat> = new Subject<
    ke.Tekenresultaat
  >();
  readonly tekenSettingsSubj: BehaviorSubject<
    option.Option<ke.TekenSettings>
  > = new BehaviorSubject<option.Option<ke.TekenSettings>>(option.none);
  readonly infoBoodschappenSubj = new BehaviorSubject<
    Map<string, InfoBoodschap>
  >(new Map());
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

export const cleanup: (model: KaartWithInfo) => void = (model) => {
  model.map.setTarget((undefined as any) as string); // Hack omdat openlayers typedefs kaduuk zijn
};
