import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, map, shareReplay } from "rxjs/operators";

import * as ke from "./kaart-elementen";
import { UiElementOpties } from "./kaart-protocol-commands";
import { Viewinstellingen } from "./kaart-protocol-subscriptions";

export interface UiElementSelectie {
  naam: string;
  aan: boolean;
}

/**
 * Dit is een verzameling van subjects waarmee de reducer wijzingen kan laten weten aan de child components.
 * Dit is isomorf aan het zetten van de overeenkomstige attributen op het model en die laten volgen. Het probleem daarbij
 * is echter dat er veel meer "oninteressante" wijzigingen aan het model gebeuren die genegeerd moeten worden. De aanpak
 * met directe subjects/observables is dus performanter.
 * Het grote nadeel is dat de reducer die het model aanpast ook expliciet de wijzigingen via de changer moet beschikbaar stellen.
 */
export interface ModelChanger {
  readonly uiElementSelectieSubj: rx.Subject<UiElementSelectie>;
  readonly uiElementOptiesSubj: rx.Subject<UiElementOpties>;
  // viewSubj zit met opzet niet in de ModelChanges, maar wel de afgeleide viewinstellingen omdat het enerzijds handiger is voor de
  // aanroepers om ol.Map te pushen, maar dat we naar de observers toe enkel de viewinstellingen willen ter beschikking stellen.
  readonly viewSubj: rx.Subject<ol.Map>;
  readonly lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<List<ke.ToegevoegdeLaag>>>;
  readonly laagVerwijderdSubj: rx.Subject<ke.ToegevoegdeLaag>;
}

export const ModelChanger: () => ModelChanger = () => ({
  uiElementSelectieSubj: new rx.Subject(),
  uiElementOptiesSubj: new rx.ReplaySubject(1),
  viewSubj: new rx.Subject(),
  lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<List<ke.ToegevoegdeLaag>>>({
    Achtergrond: new rx.BehaviorSubject(List()),
    "Voorgrond.Hoog": new rx.BehaviorSubject(List()),
    "Voorgrond.Laag": new rx.BehaviorSubject(List()),
    Tools: new rx.BehaviorSubject(List())
  }),
  laagVerwijderdSubj: new rx.Subject()
});

export interface ModelChanges {
  readonly uiElementSelectie$: rx.Observable<UiElementSelectie>;
  readonly uiElementOpties$: rx.Observable<UiElementOpties>;
  readonly viewinstellingen$: rx.Observable<Viewinstellingen>;
  readonly lagenOpGroep$: Map<ke.Laaggroep, rx.Observable<List<ke.ToegevoegdeLaag>>>;
  readonly laagVerwijderd$: rx.Observable<ke.ToegevoegdeLaag>;
}

const viewinstellingen = (olmap: ol.Map) => ({
  zoom: olmap.getView().getZoom(),
  minZoom: olmap.getView().getMinZoom(),
  maxZoom: olmap.getView().getMaxZoom(),
  resolution: olmap.getView().getResolution(),
  extent: olmap.getView().calculateExtent(olmap.getSize()),
  center: olmap.getView().getCenter()
});

export const modelChanges: (_: ModelChanger) => ModelChanges = changer => ({
  uiElementSelectie$: changer.uiElementSelectieSubj.asObservable(),
  uiElementOpties$: changer.uiElementOptiesSubj.asObservable(),
  viewinstellingen$: changer.viewSubj.asObservable().pipe(debounceTime(100), map(viewinstellingen), distinctUntilChanged(), shareReplay(1)),
  lagenOpGroep$: changer.lagenOpGroepSubj.map(s => s!.asObservable()).toMap(),
  laagVerwijderd$: changer.laagVerwijderdSubj.asObservable()
});
