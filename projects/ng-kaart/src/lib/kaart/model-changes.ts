import * as array from "fp-ts/lib/Array";
import { left, right } from "fp-ts/lib/Either";
import { Function2 } from "fp-ts/lib/function";
import { map as filterable } from "fp-ts/lib/Map";
import { none, Option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, map, mapTo, mergeAll, observeOn, share, shareReplay, switchMap } from "rxjs/operators";

import { FilterAanpassingState, GeenFilterAanpassingBezig } from "../filter/filter-aanpassing-state";
import { NosqlFsSource } from "../source/nosql-fs-source";
import * as tilecacheMetadataDb from "../util/indexeddb-tilecache-metadata";
import { observableFromOlEvents } from "../util/ol-observable";
import { updateBehaviorSubject } from "../util/subject-update";
import { ZoekAntwoord, ZoekerMetWeergaveopties, Zoekopdracht, ZoekResultaat } from "../zoeker/zoeker";

import { LaagLocationInfoService } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { UiElementOpties } from "./kaart-protocol-commands";
import { Viewinstellingen } from "./kaart-protocol-subscriptions";
import { KaartWithInfo } from "./kaart-with-info";
import { GeselecteerdeFeatures, HoverFeature } from "./kaart-with-info-model";
import * as loc from "./mijn-locatie/kaart-mijn-locatie.component";
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

export interface PrecacheLaagProgress {
  readonly [laagnaam: string]: number; // laagnaam -> progress percentage
}

export interface LaatsteCacheRefresh {
  readonly [laagnaam: string]: Date; // laagnaam -> laatste cache refresh
}

export interface MijnLocatieStateChange {
  readonly oudeState: loc.State;
  readonly nieuweState: loc.State;
  readonly event: loc.Event;
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
  readonly lagenOpGroepSubj: Map<ke.Laaggroep, rx.Subject<ke.ToegevoegdeLaag[]>>;
  readonly laagVerwijderdSubj: rx.Subject<ke.ToegevoegdeLaag>;
  readonly mijnLocatieZoomDoelSubj: rx.Subject<Option<number>>;
  readonly actieveModusSubj: rx.Subject<Option<string>>;
  readonly zoekerServicesSubj: rx.Subject<ZoekerMetWeergaveopties[]>;
  readonly zoekopdrachtSubj: rx.Subject<Zoekopdracht>;
  readonly zoekresultaatselectieSubj: rx.Subject<ZoekResultaat>;
  readonly laagLocationInfoServicesOpTitelSubj: rx.BehaviorSubject<Map<string, LaagLocationInfoService>>;
  readonly laagstijlaanpassingStateSubj: rx.Subject<LaagstijlaanpassingState>;
  readonly laagfilterGezetSubj: rx.Subject<ke.ToegevoegdeVectorLaag>;
  readonly laagstijlGezetSubj: rx.Subject<ke.ToegevoegdeVectorLaag>;
  readonly laagFilterAanpassingStateSubj: rx.Subject<FilterAanpassingState>;
  readonly dragInfoSubj: rx.Subject<DragInfo>;
  readonly tekenenOpsSubj: rx.Subject<DrawOps>;
  readonly getekendeGeometrySubj: rx.Subject<ol.geom.Geometry>;
  readonly precacheProgressSubj: rx.BehaviorSubject<PrecacheLaagProgress>;
  readonly laatsteCacheRefreshSubj: rx.BehaviorSubject<LaatsteCacheRefresh>;
  readonly mijnLocatieStateChangeSubj: rx.Subject<MijnLocatieStateChange>;
}

// Hieronder wordt een paar keer BehaviourSubject gebruikt. Dat is equivalent met, maar beknopter dan, een startWith + shareReplay
export const ModelChanger: () => ModelChanger = () => ({
  uiElementSelectieSubj: new rx.Subject<UiElementSelectie>(),
  // Om zeker te zijn dat late subscribers wel hun config messages krijgen.
  uiElementOptiesSubj: new rx.ReplaySubject<UiElementOpties>(100, 2000),
  viewPortSizeSubj: new rx.Subject<undefined>(),
  lagenOpGroepSubj: new Map<ke.Laaggroep, rx.Subject<Array<ke.ToegevoegdeLaag>>>([
    ["Achtergrond", new rx.BehaviorSubject<Array<ke.ToegevoegdeLaag>>([])],
    ["Voorgrond.Hoog", new rx.BehaviorSubject<Array<ke.ToegevoegdeLaag>>([])],
    ["Voorgrond.Laag", new rx.BehaviorSubject<Array<ke.ToegevoegdeLaag>>([])],
    ["Tools", new rx.BehaviorSubject<Array<ke.ToegevoegdeLaag>>([])]
  ]),
  laagVerwijderdSubj: new rx.Subject<ke.ToegevoegdeLaag>(),
  mijnLocatieZoomDoelSubj: new rx.BehaviorSubject<Option<number>>(none),
  actieveModusSubj: new rx.BehaviorSubject(none),
  zoekerServicesSubj: new rx.BehaviorSubject([]),
  zoekopdrachtSubj: new rx.Subject<Zoekopdracht>(),
  zoekresultaatselectieSubj: new rx.Subject<ZoekResultaat>(),
  laagLocationInfoServicesOpTitelSubj: new rx.BehaviorSubject(new Map()),
  laagstijlaanpassingStateSubj: new rx.BehaviorSubject(GeenLaagstijlaanpassing),
  laagfilterGezetSubj: new rx.Subject<ke.ToegevoegdeVectorLaag>(),
  laagstijlGezetSubj: new rx.Subject<ke.ToegevoegdeVectorLaag>(),
  laagFilterAanpassingStateSubj: new rx.BehaviorSubject(GeenFilterAanpassingBezig),
  dragInfoSubj: new rx.Subject<DragInfo>(),
  tekenenOpsSubj: new rx.Subject<DrawOps>(),
  getekendeGeometrySubj: new rx.Subject<ol.geom.Geometry>(),
  precacheProgressSubj: new rx.BehaviorSubject({}),
  laatsteCacheRefreshSubj: new rx.BehaviorSubject({}),
  mijnLocatieStateChangeSubj: new rx.Subject<MijnLocatieStateChange>()
});

export interface ModelChanges {
  readonly uiElementSelectie$: rx.Observable<UiElementSelectie>;
  readonly uiElementOpties$: rx.Observable<UiElementOpties>;
  readonly viewinstellingen$: rx.Observable<Viewinstellingen>;
  readonly lagenOpGroep: Map<ke.Laaggroep, rx.Observable<Array<ke.ToegevoegdeLaag>>>;
  readonly laagVerwijderd$: rx.Observable<ke.ToegevoegdeLaag>;
  readonly geselecteerdeFeatures$: rx.Observable<GeselecteerdeFeatures>;
  readonly hoverFeatures$: rx.Observable<HoverFeature>;
  readonly zichtbareFeatures$: rx.Observable<Array<ol.Feature>>;
  readonly kaartKlikLocatie$: rx.Observable<KlikInfo>;
  readonly mijnLocatieZoomDoel$: rx.Observable<Option<number>>;
  readonly actieveModus$: rx.Observable<Option<string>>;
  readonly zoekerServices$: rx.Observable<ZoekerMetWeergaveopties[]>;
  readonly zoekresultaten$: rx.Observable<ZoekAntwoord>;
  readonly zoekresultaatselectie$: rx.Observable<ZoekResultaat>;
  readonly laagLocationInfoServicesOpTitel$: rx.Observable<Map<string, LaagLocationInfoService>>;
  readonly laagstijlaanpassingState$: rx.Observable<LaagstijlaanpassingState>;
  readonly laagstijlGezet$: rx.Observable<ke.ToegevoegdeVectorLaag>;
  readonly laagFilterAanpassingState$: rx.Observable<FilterAanpassingState>;
  readonly laagfilterGezet$: rx.Observable<ke.ToegevoegdeVectorLaag>;
  readonly dragInfo$: rx.Observable<DragInfo>;
  readonly rotatie$: rx.Observable<number>; // een niet gedebouncede variant van "viewinstellingen$.rotatie" voor live rotatie
  readonly tekenenOps$: rx.Observable<DrawOps>;
  readonly getekendeGeometry$: rx.Observable<ol.geom.Geometry>;
  readonly precacheProgress$: rx.Observable<PrecacheLaagProgress>;
  readonly laatsteCacheRefresh$: rx.Observable<LaatsteCacheRefresh>;
  readonly mijnLocatieStateChange$: rx.Observable<MijnLocatieStateChange>;
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
    // we zouden de events kunnen bufferen met bufferTime. We moeten dan evenwel `toegevoegd` en `verwijderd` een array
    // maken ipv een option. Zolang we echter maar een paar features tegelijkertijd selecteren maakt het niet zo veel
    // uit. debounceTime is evenwel uit den boze: dan gaan er toegevoegde features verloren.
    map(evt => ({
      geselecteerd: model.geselecteerdeFeatures.getArray(),
      toegevoegd: some(evt.element),
      verwijderd: none
    }))
  );
  const verwijderdeGeselecteerdeFeatures$ = observableFromOlEvents<ol.Collection.Event>(model.geselecteerdeFeatures, "remove").pipe(
    map(evt => ({
      geselecteerd: model.geselecteerdeFeatures.getArray(),
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

  const lagenOpGroep$ = filterable.map(changer.lagenOpGroepSubj, s => s.pipe(observeOn(rx.asapScheduler)));
  const filterVectorLagen = (tlgn: ke.ToegevoegdeLaag[]) => tlgn.filter(ke.isToegevoegdeVectorLaag);
  const vectorlagen$ = lagenOpGroep$.get("Voorgrond.Hoog")!.pipe(map(filterVectorLagen));

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
      rx.merge(...vlgn.map(vlg => observableFromOlEvents(vlg!.layer.getSource(), "addfeature", "removefeature", "clear", "clear")))
    ),
    // Vlugge veranderingen van de features willen we ook niet zien.
    // Best om dit groter te houden dan de tijd voorzien om cleanup te doen. Anders overbodige events.
    debounceTime(150),
    mapTo(void 0)
  );

  const collectFeatures: (_1: prt.Viewinstellingen, _2: Array<ke.ToegevoegdeVectorLaag>) => Array<ol.Feature> = (vw, vlgn) =>
    array.array.chain(vlgn, vlg => {
      return ke.isZichtbaar(vw.resolution)(vlg) ? vlg.layer.getSource().getFeaturesInExtent(vw.extent) : [];
    });

  const zichtbareFeatures$ = rx.combineLatest(viewinstellingen$, vectorlagen$, featuresChanged$, collectFeatures);

  const kaartKlikLocatie$ = observableFromOlEvents(model.map, "click").pipe(
    map((event: ol.MapBrowserEvent) => ({
      coordinate: event.coordinate,
      coversFeature: model.map.hasFeatureAtPixel(event.pixel, {
        hitTolerance: KaartWithInfo.clickHitTolerance,
        // enkel json data features die een identify hebben beschouwen we. Zoekresultaten bvb niet
        layerFilter: layer => ke.underlyingSource(layer) instanceof NosqlFsSource
      })
    })),
    share()
  );

  const gevraagdeZoekers: Function2<Zoekopdracht, ZoekerMetWeergaveopties[], ZoekerMetWeergaveopties[]> = (opdracht, geregistreerd) =>
    geregistreerd.filter(zmp => array.elem(setoidString)(zmp.zoeker.naam(), opdracht.zoekernamen));

  const zoekresultaten$: rx.Observable<ZoekAntwoord> = changer.zoekerServicesSubj.pipe(
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

  tilecacheMetadataDb.readAll().subscribe(metadata => {
    updateBehaviorSubject(changer.laatsteCacheRefreshSubj, laatsteCacheRefresh => {
      return { ...laatsteCacheRefresh, [metadata.laagnaam]: new Date(metadata.datum) };
    });
  });

  // De reden van de asapScheduler is dat we willen dat events die naar de subjects gestuurd worden pas gezien worden
  // door eventuele observers nadat de huidige unit of execution afgehandeld is. Anders kan het gebeuren dat de output
  // van kaartCmdReducer pas opgepikt wordt nadat die van de subjects hieronder gezien is. De subjects veronderstellen
  // echter steeds het model dat door de KaartReducer gegenereerd is. We moeten dus wachten tot het nieuwe model
  // geobserveerd is (of, beter, kan geobserveerd zijn). Dit is verwant met het async posten op het model subject.
  return {
    uiElementSelectie$: changer.uiElementSelectieSubj.pipe(observeOn(rx.asapScheduler)),
    uiElementOpties$: changer.uiElementOptiesSubj.pipe(observeOn(rx.asapScheduler)),
    laagVerwijderd$: changer.laagVerwijderdSubj.pipe(observeOn(rx.asapScheduler)),
    viewinstellingen$: viewinstellingen$.pipe(observeOn(rx.asapScheduler)),
    lagenOpGroep: lagenOpGroep$,
    geselecteerdeFeatures$: geselecteerdeFeatures$.pipe(observeOn(rx.asapScheduler)),
    hoverFeatures$: hoverFeatures$.pipe(observeOn(rx.asapScheduler)),
    zichtbareFeatures$: zichtbareFeatures$.pipe(observeOn(rx.asapScheduler)),
    kaartKlikLocatie$: kaartKlikLocatie$.pipe(observeOn(rx.asapScheduler)),
    mijnLocatieZoomDoel$: changer.mijnLocatieZoomDoelSubj.pipe(observeOn(rx.asapScheduler)),
    actieveModus$: changer.actieveModusSubj.pipe(observeOn(rx.asapScheduler)),
    zoekerServices$: changer.zoekerServicesSubj.pipe(observeOn(rx.asapScheduler)),
    zoekresultaten$: zoekresultaten$.pipe(observeOn(rx.asapScheduler)),
    zoekresultaatselectie$: changer.zoekresultaatselectieSubj.pipe(observeOn(rx.asapScheduler)),
    laagLocationInfoServicesOpTitel$: changer.laagLocationInfoServicesOpTitelSubj.pipe(observeOn(rx.asapScheduler)),
    laagstijlaanpassingState$: changer.laagstijlaanpassingStateSubj.pipe(observeOn(rx.asapScheduler)),
    laagstijlGezet$: changer.laagstijlGezetSubj.pipe(observeOn(rx.asapScheduler)),
    laagFilterAanpassingState$: changer.laagFilterAanpassingStateSubj.pipe(observeOn(rx.asapScheduler)),
    laagfilterGezet$: changer.laagfilterGezetSubj.pipe(observeOn(rx.asapScheduler)),
    dragInfo$: dragInfo$.pipe(observeOn(rx.asapScheduler)),
    rotatie$: rotation$.pipe(observeOn(rx.asapScheduler)),
    tekenenOps$: changer.tekenenOpsSubj.pipe(observeOn(rx.asapScheduler)),
    getekendeGeometry$: changer.getekendeGeometrySubj.pipe(observeOn(rx.asapScheduler)),
    precacheProgress$: changer.precacheProgressSubj.pipe(observeOn(rx.asapScheduler)),
    laatsteCacheRefresh$: changer.laatsteCacheRefreshSubj.pipe(observeOn(rx.asapScheduler)),
    mijnLocatieStateChange$: changer.mijnLocatieStateChangeSubj.pipe(observeOn(rx.asapScheduler))
  };
};
