import { List, Map } from "immutable";
import * as rx from "rxjs";

import * as ke from "./kaart-elementen";
import { UiElementOpties } from "./kaart-protocol-commands";
import { Zoominstellingen } from "./kaart-protocol-subscriptions";

export interface UiElementSelectie {
  naam: string;
  aan: boolean;
}

/**
 * Dit is een verzameling van subjects waarmee de reducer wijzingen kan laten weten aan de child components.
 * Dit is isomorf aan het zetten van de overeenkomstige attributen op het model en die laten volgen. Het probleem daarbij
 * is echter dat er veel meer "oninteressante" wijzigingen aan het model gebeuren die genegeerd moeten worden. De aanpak
 * met directe subjects/observables is dus performanter.
 */
export interface ModelChanger {
  readonly uiElementSelectieSubj: rx.Subject<UiElementSelectie>;
  readonly uiElementOptiesSubj: rx.Subject<UiElementOpties>;
  readonly zoominstellingenSubj: rx.Subject<Zoominstellingen>;
  readonly lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<List<ke.ToegevoegdeLaag>>>;
}

export const ModelChanger: () => ModelChanger = () => ({
  uiElementSelectieSubj: new rx.Subject<UiElementSelectie>(),
  uiElementOptiesSubj: new rx.ReplaySubject<UiElementOpties>(1),
  zoominstellingenSubj: new rx.ReplaySubject<Zoominstellingen>(1),
  lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<List<ke.ToegevoegdeLaag>>>({
    Achtergrond: new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List()),
    "Voorgrond.Hoog": new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List()),
    "Voorgrond.Laag": new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List()),
    Tools: new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List())
  })
});

export interface ModelChanges {
  readonly uiElementSelectie$: rx.Observable<UiElementSelectie>;
  readonly uiElementOpties$: rx.Observable<UiElementOpties>;
  readonly zoomInstellingen$: rx.Observable<Zoominstellingen>;
  readonly lagenOpGroep$: Map<ke.Laaggroep, rx.Observable<List<ke.ToegevoegdeLaag>>>;
}

export const modelChanges: (changer: ModelChanger) => ModelChanges = changer => ({
  uiElementSelectie$: changer.uiElementSelectieSubj.asObservable(),
  uiElementOpties$: changer.uiElementOptiesSubj.asObservable(),
  zoomInstellingen$: changer.zoominstellingenSubj.asObservable(),
  lagenOpGroep$: changer.lagenOpGroepSubj.map(s => s!.asObservable()).toMap()
});
