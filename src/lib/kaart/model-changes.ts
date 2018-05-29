import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";

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
  readonly viewinstellingenSubj: rx.Subject<Viewinstellingen>;
  readonly lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<List<ke.ToegevoegdeLaag>>>;
  readonly laagVerwijderdSubj: rx.Subject<ke.ToegevoegdeLaag>;
}

export const ModelChanger: () => ModelChanger = () => ({
  uiElementSelectieSubj: new rx.Subject(),
  uiElementOptiesSubj: new rx.ReplaySubject(1),
  viewinstellingenSubj: new rx.ReplaySubject(1), // bekende beperking: geen output wanneer viewport wijzigt
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
  readonly viewInstellingen$: rx.Observable<Viewinstellingen>;
  readonly lagenOpGroep$: Map<ke.Laaggroep, rx.Observable<List<ke.ToegevoegdeLaag>>>;
  readonly laagVerwijderd$: rx.Observable<ke.ToegevoegdeLaag>;
}

export const modelChanges: (_: ModelChanger) => ModelChanges = changer => ({
  uiElementSelectie$: changer.uiElementSelectieSubj.asObservable(),
  uiElementOpties$: changer.uiElementOptiesSubj.asObservable(),
  viewInstellingen$: changer.viewinstellingenSubj.asObservable(),
  lagenOpGroep$: changer.lagenOpGroepSubj.map(s => s!.asObservable()).toMap(),
  laagVerwijderd$: changer.laagVerwijderdSubj.asObservable()
});
