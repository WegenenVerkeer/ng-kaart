import * as rx from "rxjs";

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
  readonly huidigeZoomSubj: rx.Subject<Zoominstellingen>;
}

export const modelChanger: ModelChanger = {
  uiElementSelectieSubj: new rx.Subject<UiElementSelectie>(),
  uiElementOptiesSubj: new rx.ReplaySubject<UiElementOpties>(1),
  huidigeZoomSubj: new rx.ReplaySubject<Zoominstellingen>(1)
};

export interface ModelChanges {
  readonly uiElementSelectie$: rx.Observable<UiElementSelectie>;
  readonly uiElementOpties$: rx.Observable<UiElementOpties>;
  readonly huidigeZoom$: rx.Observable<Zoominstellingen>;
}

export const modelChanges: (changer: ModelChanger) => ModelChanges = changer => ({
  uiElementSelectie$: changer.uiElementSelectieSubj.asObservable(),
  uiElementOpties$: changer.uiElementOptiesSubj.asObservable(),
  huidigeZoom$: changer.huidigeZoomSubj.asObservable()
});
