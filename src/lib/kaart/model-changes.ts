import * as rx from "rxjs";
import { Set } from "immutable";
import { Tuple } from "fp-ts/lib/Tuple";
import { Zoominstellingen } from "./kaart-protocol-subscriptions";

export interface UIElementSelectie {
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
  readonly uiElementenSelectieSubj: rx.Subject<UIElementSelectie>;
  readonly huidigeZoomSubj: rx.Subject<Zoominstellingen>;
}

export const modelChanger: ModelChanger = {
  uiElementenSelectieSubj: new rx.Subject<UIElementSelectie>(),
  huidigeZoomSubj: new rx.ReplaySubject(1)
};

export interface ModelChanges {
  readonly uiElementenSelectie$: rx.Observable<UIElementSelectie>;
  readonly huidigeZoom$: rx.Observable<Zoominstellingen>;
}

export const modelChanges: (changer: ModelChanger) => ModelChanges = changer => ({
  uiElementenSelectie$: changer.uiElementenSelectieSubj.asObservable(),
  huidigeZoom$: changer.huidigeZoomSubj.asObservable()
});
