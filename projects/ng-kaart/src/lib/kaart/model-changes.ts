import * as array from "fp-ts/lib/Array";
import { left, right } from "fp-ts/lib/Either";
import { Function2 } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, mapTo, mergeAll, share, shareReplay, switchMap } from "rxjs/operators";

import { NosqlFsSource } from "../source/nosql-fs-source";
import { observableFromOlEvents } from "../util/ol-observable";
import { ZoekAntwoord, ZoekerMetPrioriteiten, Zoekopdracht, ZoekResultaat } from "../zoeker/zoeker";

import { LaagLocationInfoService } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { UiElementOpties } from "./kaart-protocol-commands";
import { Viewinstellingen } from "./kaart-protocol-subscriptions";
import { KaartWithInfo } from "./kaart-with-info";
import { GeselecteerdeFeatures, HoverFeature } from "./kaart-with-info-model";
import { GeenLaagstijlaanpassing, LaagstijlaanpassingState } from "./stijleditor/state";
import { DrawOps } from "./tekenen/tekenen-model";

export interface UiElementSelectie {
  readonly naam: string;
  readonly aan: boolean;
}

export interface DragInfo {
  readonly pixel: ol.Pixel;
  readonly coordinate: ol.Coordinate;
}

export interface KlikInfo {
  readonly coordinate: ol.Coordinate;
  readonly coversFeature: boolean;
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
  readonly viewPortSizeSubj: rx.Subject<undefined>;
  readonly lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<List<ke.ToegevoegdeLaag>>>;
  readonly laagVerwijderdSubj: rx.Subject<ke.ToegevoegdeLaag>;
  readonly mijnLocatieZoomDoelSubj: rx.Subject<Option<number>>;
  readonly actieveModusSubj: rx.Subject<Option<string>>;
  readonly zoekerServicesSubj: rx.Subject<ZoekerMetPrioriteiten[]>;
  readonly zoekopdrachtSubj: rx.Subject<Zoekopdracht>;
  readonly zoekresultaatselectieSubj: rx.Subject<ZoekResultaat>;
  readonly laagLocationInfoServicesOpTitelSubj: rx.BehaviorSubject<Map<string, LaagLocationInfoService>>;
  readonly laagstijlaanpassingStateSubj: rx.Subject<LaagstijlaanpassingState>;
  readonly laagstijlGezetSubj: rx.Subject<ke.ToegevoegdeVectorLaag>;
  readonly dragInfoSubj: rx.Subject<DragInfo>;
  readonly tekenenOpsSubj: rx.Subject<DrawOps>;
}

// Hieronder wordt een paar keer BehaviourSubject gebruikt. Dat is equivalent met, maar beknopter dan, een startWith + shareReplay
export const ModelChanger: () => ModelChanger = () => ({
  uiElementSelectieSubj: new rx.Subject<UiElementSelectie>(),
  uiElementOptiesSubj: new rx.ReplaySubject<UiElementOpties>(1),
  viewPortSizeSubj: new rx.Subject<undefined>(),
  lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<List<ke.ToegevoegdeLaag>>>({
    Achtergrond: new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List()),
    "Voorgrond.Hoog": new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List()),
    "Voorgrond.Laag": new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List()),
    Tools: new rx.BehaviorSubject<List<ke.ToegevoegdeLaag>>(List())
  }),
  laagVerwijderdSubj: new rx.Subject<ke.ToegevoegdeLaag>(),
  mijnLocatieZoomDoelSubj: new rx.BehaviorSubject<Option<number>>(none),
  actieveModusSubj: new rx.BehaviorSubject(none),
  zoekerServicesSubj: new rx.BehaviorSubject([]),
  zoekopdrachtSubj: new rx.Subject<Zoekopdracht>(),
  zoekresultaatselectieSubj: new rx.Subject<ZoekResultaat>(),
  laagLocationInfoServicesOpTitelSubj: new rx.BehaviorSubject(Map()),
  laagstijlaanpassingStateSubj: new rx.BehaviorSubject(GeenLaagstijlaanpassing),
  laagstijlGezetSubj: new rx.Subject<ke.ToegevoegdeVectorLaag>(),
  dragInfoSubj: new rx.Subject<DragInfo>(),
  tekenenOpsSubj: new rx.Subject<DrawOps>()
});

export interface ModelChanges {
  readonly uiElementSelectie$: rx.Observable<UiElementSelectie>;
  readonly uiElementOpties$: rx.Observable<UiElementOpties>;
  readonly viewinstellingen$: rx.Observable<Viewinstellingen>;
  readonly lagenOpGroep: Map<ke.Laaggroep, rx.Observable<List<ke.ToegevoegdeLaag>>>;
  readonly laagVerwijderd$: rx.Observable<ke.ToegevoegdeLaag>;
  readonly geselecteerdeFeatures$: rx.Observable<GeselecteerdeFeatures>;
  readonly hoverFeatures$: rx.Observable<HoverFeature>;
  readonly zichtbareFeatures$: rx.Observable<List<ol.Feature>>;
  readonly kaartKlikLocatie$: rx.Observable<KlikInfo>;
  readonly mijnLocatieZoomDoel$: rx.Observable<Option<number>>;
  readonly actieveModus$: rx.Observable<Option<string>>;
  readonly zoekerServices$: rx.Observable<ZoekerMetPrioriteiten[]>;
  readonly zoekresultaten$: rx.Observable<ZoekAntwoord>;
  readonly zoekresultaatselectie$: rx.Observable<ZoekResultaat>;
  readonly laagLocationInfoServicesOpTitel$: rx.Observable<Map<string, LaagLocationInfoService>>;
  readonly laagstijlaanpassingState$: rx.Observable<LaagstijlaanpassingState>;
  readonly laagstijlGezet$: rx.Observable<ke.ToegevoegdeVectorLaag>;
  readonly dragInfo$: rx.Observable<DragInfo>;
  readonly rotatie$: rx.Observable<number>; // een niet gedebouncede variant van "viewinstellingen$.rotatie" voor live rotatie
  readonly tekenenOps$: rx.Observable<DrawOps>;
}

const viewinstellingen = (olmap: ol.Map) => ({
  zoom: olmap.getView().getZoom(),
  minZoom: olmap.getView().getMinZoom(),
  maxZoom: olmap.getView().getMaxZoom(),
  resolution: olmap.getView().getResolution(),
  extent: olmap.getView().calculateExtent(olmap.getSize()),
  center: olmap.getView().getCenter(),
  rotation: olmap.getView().getRotation()
});

export const modelChanges: (_1: KaartWithInfo, _2: ModelChanger) => ModelChanges = (model, changer) => {
  const toegevoegdeGeselecteerdeFeatures$ = observableFromOlEvents<ol.Collection.Event>(model.geselecteerdeFeatures, "add").pipe(
    map(evt => ({
      geselecteerd: List(model.geselecteerdeFeatures.getArray()),
      toegevoegd: some(evt.element),
      verwijderd: none
    }))
  );
  const verwijderdeGeselecteerdeFeatures$ = observableFromOlEvents<ol.Collection.Event>(model.geselecteerdeFeatures, "remove").pipe(
    map(evt => ({
      geselecteerd: List(model.geselecteerdeFeatures.getArray()),
      toegevoegd: none,
      verwijderd: some(evt.element)
    }))
  );

  const geselecteerdeFeatures$ = rx.merge(toegevoegdeGeselecteerdeFeatures$, verwijderdeGeselecteerdeFeatures$).pipe(shareReplay(1));

  const hoverFeatures$ = observableFromOlEvents<ol.Collection.Event>(model.hoverFeatures, "add", "remove").pipe(
    map(event =>
      event.type === "add"
        ? {
            hover: right<ol.Feature, ol.Feature>(event.element)
          }
        : {
            hover: left<ol.Feature, ol.Feature>(event.element)
          }
    )
  );

  // Met window resize hebben we niet alle bronnen van herschaling, maar toch al een grote
  const resize$ = rx.fromEvent(window, "resize").pipe(debounceTime(100));

  const center$ = observableFromOlEvents(model.map.getView(), "change:center").pipe(debounceTime(100));
  const numlayers$ = observableFromOlEvents(model.map.getLayers(), "change:length").pipe(debounceTime(100));
  const zoom$ = observableFromOlEvents(model.map.getView(), "change:resolution").pipe(
    map(() => model.map.getView().getZoom()),
    distinctUntilChanged()
    // geen debounce, OL genereert wel enkele tussenliggende zooms tijden het pinch/zoomen, maar ze komen ver genoeg uiteen.
  );

  const rotation$ = observableFromOlEvents<ol.ObjectEvent>(model.map.getView(), "change:rotation").pipe(
    map(event => event.target.get(event.key) as number)
  );

  const viewportSize$ = changer.viewPortSizeSubj.pipe(debounceTime(100));

  const viewinstellingen$ = rx.merge(viewportSize$, resize$, center$, numlayers$, zoom$, rotation$).pipe(
    debounceTime(50), // Deze is om de map hierna niet te veel werk te geven
    map(() => viewinstellingen(model.map)),
    shareReplay(1)
  );

  const dragInfo$ = observableFromOlEvents<ol.MapBrowserEvent>(model.map, "pointerdrag").pipe(
    debounceTime(100),
    map(event => ({
      pixel: event.pixel,
      coordinate: event.coordinate
    }))
  );

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
  const featuresChanged$: rx.Observable<undefined> = vectorlagen$.pipe(
    debounceTime(100), // vlugge verandering van het aantal vectorlagen willen we niet zien
    switchMap(vlgn =>
      rx.merge(
        ...vlgn.map(vlg => observableFromOlEvents(vlg!.layer.getSource(), "addfeature", "removefeature", "clear", "clear")).toArray()
      )
    ),
    // Vlugge veranderingen van de features willen we ook niet zien.
    // Best om dit groter te houden dan de tijd voorzien om cleanup te doen. Anders overbodige events.
    debounceTime(100),
    mapTo(void 0)
  );

  const collectFeatures: (_1: prt.Viewinstellingen, _2: List<ke.ToegevoegdeVectorLaag>) => List<ol.Feature> = (vw, vlgn) =>
    List(
      array.array.chain(vlgn.toArray(), vlg => {
        return ke.isZichtbaar(vw.resolution)(vlg) ? vlg.layer.getSource().getFeaturesInExtent(vw.extent) : [];
      })
    );

  const zichtbareFeatures$ = rx.combineLatest(viewinstellingen$, vectorlagen$, featuresChanged$, collectFeatures);

  const kaartKlikLocatie$ = observableFromOlEvents(model.map, "click").pipe(
    map((event: ol.MapBrowserEvent) => ({
      coordinate: event.coordinate,
      coversFeature: model.map.hasFeatureAtPixel(event.pixel, {
        hitTolerance: KaartWithInfo.clickHitTolerance,
        // enkel json data features die een identify hebben beschouwen we. Zoekresultaten bvb niet
        layerFilter: layer => layer.getSource() instanceof NosqlFsSource
      })
    })),
    share()
  );

  const gevraagdeZoekers: Function2<Zoekopdracht, ZoekerMetPrioriteiten[], ZoekerMetPrioriteiten[]> = (opdracht, geregistreerd) =>
    geregistreerd.filter(zmp => array.member(setoidString)(opdracht.zoekernamen, zmp.zoeker.naam()));

  const zoekresulaten$: rx.Observable<ZoekAntwoord> = changer.zoekerServicesSubj.pipe(
    switchMap(zoekerSvcs =>
      changer.zoekopdrachtSubj.pipe(
        switchMap(zoekopdracht =>
          rx
            .from(gevraagdeZoekers(zoekopdracht, zoekerSvcs).map(zmp => zmp.zoeker.zoekresultaten$(zoekopdracht))) //
            .pipe(mergeAll())
        )
      )
    )
  );

  return {
    uiElementSelectie$: changer.uiElementSelectieSubj.asObservable(),
    uiElementOpties$: changer.uiElementOptiesSubj.asObservable(),
    laagVerwijderd$: changer.laagVerwijderdSubj.asObservable(),
    viewinstellingen$: viewinstellingen$,
    lagenOpGroep: lagenOpGroep$,
    geselecteerdeFeatures$: geselecteerdeFeatures$,
    hoverFeatures$: hoverFeatures$,
    zichtbareFeatures$: zichtbareFeatures$,
    kaartKlikLocatie$: kaartKlikLocatie$,
    mijnLocatieZoomDoel$: changer.mijnLocatieZoomDoelSubj.asObservable(),
    actieveModus$: changer.actieveModusSubj.asObservable(),
    zoekerServices$: changer.zoekerServicesSubj.asObservable(),
    zoekresultaten$: zoekresulaten$,
    zoekresultaatselectie$: changer.zoekresultaatselectieSubj.asObservable(),
    laagLocationInfoServicesOpTitel$: changer.laagLocationInfoServicesOpTitelSubj.asObservable(),
    laagstijlaanpassingState$: changer.laagstijlaanpassingStateSubj.asObservable(),
    laagstijlGezet$: changer.laagstijlGezetSubj.asObservable(),
    dragInfo$: dragInfo$,
    rotatie$: rotation$,
    tekenenOps$: changer.tekenenOpsSubj.asObservable()
  };
};
