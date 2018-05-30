import { array } from "fp-ts/lib/Array";
import { none, some } from "fp-ts/lib/Option";
import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { combineLatest, debounceTime, distinctUntilChanged, map, merge, shareReplay, switchMap } from "rxjs/operators";

import { observableFromOlEvent, observableFromOlEvents } from "../util/ol-observable";

import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { UiElementOpties } from "./kaart-protocol-commands";
import { Viewinstellingen } from "./kaart-protocol-subscriptions";
import { KaartWithInfo } from "./kaart-with-info";
import { GeselecteerdeFeatures } from "./kaart-with-info-model";

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
  readonly geselecteerdeFeatures$: rx.Observable<GeselecteerdeFeatures>;
  readonly zichtbareFeatures$: rx.Observable<List<ol.Feature>>;
}

const viewinstellingen = (olmap: ol.Map) => ({
  zoom: olmap.getView().getZoom(),
  minZoom: olmap.getView().getMinZoom(),
  maxZoom: olmap.getView().getMaxZoom(),
  resolution: olmap.getView().getResolution(),
  extent: olmap.getView().calculateExtent(olmap.getSize()),
  center: olmap.getView().getCenter()
});

export const modelChanges: (_1: KaartWithInfo, _2: ModelChanger) => ModelChanges = (model, changer) => {
  const toegevoegdeGeselecteerdeFeatures$ = observableFromOlEvent<ol.Collection.Event>(model.geselecteerdeFeatures, "add").pipe(
    map(evt => ({
      geselecteerd: List(model.geselecteerdeFeatures.getArray()),
      toegevoegd: some(evt.element),
      verwijderd: none
    }))
  );
  const verwijderdeGeselecteerdeFeatures$ = observableFromOlEvent<ol.Collection.Event>(model.geselecteerdeFeatures, "remove").pipe(
    map(evt => ({
      geselecteerd: List(model.geselecteerdeFeatures.getArray()),
      toegevoegd: none,
      verwijderd: some(evt.element)
    }))
  );

  const geselecteerdeFeatures$ = toegevoegdeGeselecteerdeFeatures$.pipe(
    merge(verwijderdeGeselecteerdeFeatures$),
    debounceTime(50),
    shareReplay(1)
  );

  const viewinstellingen$ = changer.viewSubj
    .asObservable()
    .pipe(debounceTime(100), map(viewinstellingen), distinctUntilChanged(), shareReplay(1));

  const lagenOpGroep$ = changer.lagenOpGroepSubj.map(s => s!.asObservable()).toMap();
  const filterVectorLagen = (tlgn: List<ke.ToegevoegdeLaag>) =>
    tlgn.filter(ke.isToegevoegdeVectorLaag).toList() as List<ke.ToegevoegdeVectorLaag>;
  const vectorlagen$ = lagenOpGroep$.get("Voorgrond.Hoog").pipe(map(filterVectorLagen));

  // Om te weten welke features er zichtbaar zijn op een pagina zou het voldoende moeten zijn om te weten welke lagen er zijn, welke van
  // die lagen zichtbaar zijn en welke features er op de lagen in de huidige extent staan. Op zich is dat ook zo, maar het probleem is
  // dat openlayers features ophaalt in de achtergrond. Wanneer je naar een bepaalde extent gaat, zal er direct een event uit de
  // viewinstellingen$ komen, maar de features zelf zijn er op dat moment nog niet noodzakelijk. De call naar getFeaturesInExtent zal dan
  // te weinig resultaten opleveren. Daarom voegen we nog een extra event toe wanneer openlayers klaar is met laden.
  // We gebruiker de addfeature en removefeature, and clear triggers. Het interesseert ons daarbij niet wat de features zijn. Het is ons
  // enkel te doen om te weten dat er veranderingen zijn (de generieke change event op zich blijkt geen events te genereren).
  // Implementatienota: doordat alles via observables gaat (en de swithMap), worden de unsubscribes naar OL doorgespeeld.
  const featuresChanged$ = vectorlagen$.pipe(
    switchMap(vlgn =>
      rx.Observable.merge(
        ...vlgn.map(vlg => observableFromOlEvents(vlg.layer.getSource(), ["addfeature", "removefeature", "clear"])).toArray()
      ).pipe(debounceTime(200))
    )
  );

  const collectFeatures: (_1: prt.Viewinstellingen, _2: List<ke.ToegevoegdeVectorLaag>) => List<ol.Feature> = (vw, vlgn) =>
    List(
      array.chain(vlgn.toArray(), vlg => {
        return ke.isZichtbaar(vw.resolution)(vlg) ? vlg.layer.getSource().getFeaturesInExtent(vw.extent) : [];
      })
    );

  const zichtbareFeatures$ = viewinstellingen$.pipe(combineLatest(vectorlagen$, featuresChanged$, collectFeatures));

  return {
    uiElementSelectie$: changer.uiElementSelectieSubj.asObservable(),
    uiElementOpties$: changer.uiElementOptiesSubj.asObservable(),
    laagVerwijderd$: changer.laagVerwijderdSubj.asObservable(),
    viewinstellingen$: viewinstellingen$,
    lagenOpGroep$: lagenOpGroep$,
    geselecteerdeFeatures$: geselecteerdeFeatures$,
    zichtbareFeatures$: zichtbareFeatures$
  };
};
