import { NgZone } from "@angular/core";
import { array } from "fp-ts";
import { left, right } from "fp-ts/lib/Either";
import { flow, Function1, Function2, Function3 } from "fp-ts/lib/function";
import { none, Option } from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import { setoidString } from "fp-ts/lib/Setoid";
import * as ol from "openlayers";
import * as rx from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  map,
  mapTo,
  mergeAll,
  observeOn,
  pairwise,
  share,
  shareReplay,
  startWith,
  switchMap
} from "rxjs/operators";

import { roundCoordinate } from "../coordinaten";
import { FilterAanpassingState as FilteraanpassingState, GeenFilterAanpassingBezig } from "../filter/filter-aanpassing-state";
import { NosqlFsSource } from "../source/nosql-fs-source";
import { GeenTransparantieaanpassingBezig, TransparantieaanpassingState } from "../transparantieeditor/state";
import { Feature, FeatureWithIdAndLaagnaam } from "../util/feature";
import * as tilecacheMetadataDb from "../util/indexeddb-tilecache-metadata";
import { observeAsapOnAngular } from "../util/observe-asap-on-angular";
import { observableFromOlEvents } from "../util/ol-observable";
import { collectOption, scan2 } from "../util/operators";
import { updateBehaviorSubject } from "../util/subject-update";
import { ZoekAntwoord, ZoekerMetWeergaveopties, Zoekopdracht, ZoekResultaat } from "../zoeker/zoeker";

import { LaagLocationInfoService } from "./kaart-bevragen/laaginfo.model";
import { envParams } from "./kaart-config";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { GeselecteerdeFeatures, Viewinstellingen } from "./kaart-protocol-subscriptions";
import { KaartWithInfo } from "./kaart-with-info";
import { HoverFeature } from "./kaart-with-info-model";
import * as loc from "./mijn-locatie/kaart-mijn-locatie.component";
import { GeenLaagstijlaanpassing, LaagstijlaanpassingState } from "./stijleditor/state";
import * as TabelState from "./tabel-state";
import { DrawOps } from "./tekenen/tekenen-model";
import { OptiesOpUiElement } from "./ui-element-opties";

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
  readonly optiesOpUiElementSubj: rx.BehaviorSubject<OptiesOpUiElement>;
  readonly viewPortSizeSubj: rx.Subject<null>;
  readonly lagenOpGroepSubj: ke.OpLaagGroep<rx.BehaviorSubject<ke.ToegevoegdeLaag[]>>;
  readonly laagVerwijderdSubj: rx.Subject<ke.ToegevoegdeLaag>;
  readonly mijnLocatieZoomDoelSubj: rx.Subject<Option<number>>;
  readonly laagTabelExtaKnopKlikkenSubj: rx.Subject<prt.LaagTabelKnopKlik>;
  readonly actieveModusSubj: rx.Subject<Option<string>>;
  readonly zoekerServicesSubj: rx.Subject<ZoekerMetWeergaveopties[]>;
  readonly zoekopdrachtSubj: rx.Subject<Zoekopdracht>;
  readonly zoekresultaatselectieSubj: rx.Subject<ZoekResultaat>;
  readonly laagLocationInfoServicesOpTitelSubj: rx.BehaviorSubject<Map<string, LaagLocationInfoService>>;
  readonly laagstijlaanpassingStateSubj: rx.Subject<LaagstijlaanpassingState>;
  readonly laagfilterGezetSubj: rx.Subject<ke.ToegevoegdeVectorLaag>;
  readonly laagstijlGezetSubj: rx.Subject<ke.ToegevoegdeVectorLaag>;
  readonly laagfilteraanpassingStateSubj: rx.Subject<FilteraanpassingState>;
  readonly transparantieAanpassingStateSubj: rx.Subject<TransparantieaanpassingState>;
  readonly dragInfoSubj: rx.Subject<DragInfo>;
  readonly tekenenOpsSubj: rx.Subject<DrawOps>;
  readonly getekendeGeometrySubj: rx.Subject<ol.geom.Geometry>;
  readonly precacheProgressSubj: rx.BehaviorSubject<PrecacheLaagProgress>;
  readonly laatsteCacheRefreshSubj: rx.BehaviorSubject<LaatsteCacheRefresh>;
  readonly mijnLocatieStateChangeSubj: rx.Subject<MijnLocatieStateChange>;
  readonly zoombereikChangeSubj: rx.Subject<null>;
  readonly tabelActiviteitSubj: rx.BehaviorSubject<TabelState.TabelActiviteit>;
  readonly dataloadBusySubj: rx.BehaviorSubject<boolean>;
  readonly forceProgressBarSubj: rx.BehaviorSubject<boolean>;
  readonly collapseUIRequestSubj: rx.Subject<null>; // Indien nodig uit te breiden met doen en/of bron
  readonly inErrorSubj: rx.BehaviorSubject<boolean>;
  readonly tabelLaagInstellingenSubj: rx.Subject<prt.Laagtabelinstellingen>;
}

// Hieronder wordt een paar keer BehaviourSubject gebruikt. Dat is equivalent met, maar beknopter dan, een startWith + shareReplay
export const ModelChanger: () => ModelChanger = () => ({
  uiElementSelectieSubj: new rx.Subject<UiElementSelectie>(),
  optiesOpUiElementSubj: new rx.BehaviorSubject<OptiesOpUiElement>(OptiesOpUiElement.create()),
  viewPortSizeSubj: new rx.Subject<null>(),
  lagenOpGroepSubj: {
    Achtergrond: new rx.BehaviorSubject<ke.ToegevoegdeLaag[]>([]),
    "Voorgrond.Hoog": new rx.BehaviorSubject<ke.ToegevoegdeLaag[]>([]),
    "Voorgrond.Laag": new rx.BehaviorSubject<ke.ToegevoegdeLaag[]>([]),
    Tools: new rx.BehaviorSubject<ke.ToegevoegdeLaag[]>([])
  },
  laagVerwijderdSubj: new rx.Subject<ke.ToegevoegdeLaag>(),
  mijnLocatieZoomDoelSubj: new rx.BehaviorSubject<Option<number>>(none),
  laagTabelExtaKnopKlikkenSubj: new rx.Subject<prt.LaagTabelKnopKlik>(),
  actieveModusSubj: new rx.BehaviorSubject(none),
  zoekerServicesSubj: new rx.BehaviorSubject([]),
  zoekopdrachtSubj: new rx.Subject<Zoekopdracht>(),
  zoekresultaatselectieSubj: new rx.Subject<ZoekResultaat>(),
  laagLocationInfoServicesOpTitelSubj: new rx.BehaviorSubject(new Map()),
  laagstijlaanpassingStateSubj: new rx.BehaviorSubject(GeenLaagstijlaanpassing),
  laagfilterGezetSubj: new rx.Subject<ke.ToegevoegdeVectorLaag>(),
  laagstijlGezetSubj: new rx.Subject<ke.ToegevoegdeVectorLaag>(),
  laagfilteraanpassingStateSubj: new rx.BehaviorSubject(GeenFilterAanpassingBezig),
  transparantieAanpassingStateSubj: new rx.BehaviorSubject(GeenTransparantieaanpassingBezig),
  dragInfoSubj: new rx.Subject<DragInfo>(),
  tekenenOpsSubj: new rx.Subject<DrawOps>(),
  getekendeGeometrySubj: new rx.Subject<ol.geom.Geometry>(),
  precacheProgressSubj: new rx.BehaviorSubject({}),
  laatsteCacheRefreshSubj: new rx.BehaviorSubject({}),
  mijnLocatieStateChangeSubj: new rx.Subject<MijnLocatieStateChange>(),
  zoombereikChangeSubj: new rx.Subject<null>(),
  tabelActiviteitSubj: new rx.BehaviorSubject<TabelState.TabelActiviteit>(TabelState.Onbeschikbaar),
  dataloadBusySubj: new rx.BehaviorSubject<boolean>(false),
  forceProgressBarSubj: new rx.BehaviorSubject<boolean>(false),
  collapseUIRequestSubj: new rx.Subject<null>(),
  inErrorSubj: new rx.BehaviorSubject<boolean>(false),
  tabelLaagInstellingenSubj: new rx.Subject<prt.Laagtabelinstellingen>()
});

export interface ModelChanges {
  readonly uiElementSelectie$: rx.Observable<UiElementSelectie>;
  readonly optiesOpUiElement$: rx.Observable<OptiesOpUiElement>;
  readonly viewinstellingen$: rx.Observable<Viewinstellingen>;
  readonly laagTabelExtaKnopKlikken$: rx.Observable<prt.LaagTabelKnopKlik>;
  readonly tabelLaagInstellingen$: rx.Observable<prt.Laagtabelinstellingen>;
  readonly lagenOpGroep: ke.OpLaagGroep<rx.Observable<ke.ToegevoegdeLaag[]>>;
  readonly laagVerwijderd$: rx.Observable<ke.ToegevoegdeLaag>;
  readonly geselecteerdeFeatures$: rx.Observable<GeselecteerdeFeatures>;
  readonly hoverFeatures$: rx.Observable<HoverFeature>;
  readonly zichtbareFeatures$: rx.Observable<ol.Feature[]>;
  readonly zichtbareFeaturesPerLaag$: rx.Observable<ReadonlyMap<string, ol.Feature[]>>;
  readonly kaartKlikLocatie$: rx.Observable<KlikInfo>;
  readonly mijnLocatieZoomDoel$: rx.Observable<Option<number>>;
  readonly actieveModus$: rx.Observable<Option<string>>;
  readonly zoekerServices$: rx.Observable<ZoekerMetWeergaveopties[]>;
  readonly zoekresultaten$: rx.Observable<ZoekAntwoord>;
  readonly zoekresultaatselectie$: rx.Observable<ZoekResultaat>;
  readonly laagLocationInfoServicesOpTitel$: rx.Observable<Map<string, LaagLocationInfoService>>;
  readonly laagstijlaanpassingState$: rx.Observable<LaagstijlaanpassingState>;
  readonly laagstijlGezet$: rx.Observable<ke.ToegevoegdeVectorLaag>;
  readonly laagfilteraanpassingState$: rx.Observable<FilteraanpassingState>;
  readonly transparantieaanpassingState$: rx.Observable<TransparantieaanpassingState>;
  readonly laagfilterGezet$: rx.Observable<ke.ToegevoegdeVectorLaag>;
  readonly dragInfo$: rx.Observable<DragInfo>;
  readonly rotatie$: rx.Observable<number>; // een niet gedebouncede variant van "viewinstellingen$.rotatie" voor live rotatie
  readonly tekenenOps$: rx.Observable<DrawOps>;
  readonly getekendeGeometry$: rx.Observable<ol.geom.Geometry>;
  readonly precacheProgress$: rx.Observable<PrecacheLaagProgress>;
  readonly laatsteCacheRefresh$: rx.Observable<LaatsteCacheRefresh>;
  readonly mijnLocatieStateChange$: rx.Observable<MijnLocatieStateChange>;
  readonly dataloadBusy$: rx.Observable<boolean>;
  readonly forceProgressBar$: rx.Observable<boolean>;
  readonly inError$: rx.Observable<boolean>;
  readonly tabelActiviteit$: rx.Observable<TabelState.TabelActiviteit>;
  readonly collapseUIRequest$: rx.Observable<null>;
}

const viewinstellingen: Function1<ol.Map, prt.Viewinstellingen> = olmap => ({
  zoom: olmap.getView().getZoom(),
  minZoom: olmap.getView().getMinZoom(),
  maxZoom: olmap.getView().getMaxZoom(),
  resolution: olmap.getView().getResolution(),
  extent: olmap.getView().calculateExtent(olmap.getSize()),
  center: olmap.getView().getCenter(),
  rotation: olmap.getView().getRotation()
});

export const featuresOpIdToArray = (perLaag: prt.KaartFeaturesOpId): ol.Feature[] =>
  array.map((f: FeatureWithIdAndLaagnaam) => f.feature)([...perLaag.values()]);

export const modelChanges = (model: KaartWithInfo, changer: ModelChanger, zone: NgZone): ModelChanges => {
  // We updaten de features niet constant. We doen dat omdat we naar de buitenwereld de illusie willen wekken dat
  // features als een groep geselecteerd worden. Openlayers daarentegen genereert afzonderlijke events per feature dat
  // toegevoegd of verwijderd wordt. Daarom nemen wij een tweetrapsaanpak waarbij we eerst een collectie opbouwen met
  // adds en deletes.
  const featureSelectionUpdateInterval = 2;
  // Features zonder laagnaam en id negeren we gewoon
  const selectionEventToFeature = (evt: ol.Collection.Event) => Feature.featureWithIdAndLaagnaam(evt.element as ol.Feature);

  const collectFeaturesFromOl$ = (operation: string) =>
    observableFromOlEvents<ol.Collection.Event>(model.geselecteerdeFeatures, operation).pipe(collectOption(selectionEventToFeature));
  const addedFeature$ = collectFeaturesFromOl$("add");
  const removedFeature$ = collectFeaturesFromOl$("remove");

  const featuresOpLaagToArray = (featuresPerLaag: prt.KaartFeaturesOpLaag) =>
    array.chain(featuresOpIdToArray)([...featuresPerLaag.values()]);

  // Berekent de features die wel in map1 zitten, maar niet in map2
  const difference = (map1: prt.KaartFeaturesOpId, map2: prt.KaartFeaturesOpId): ol.Feature[] =>
    pipe(
      [...map1.values()],
      array.filter(f => !map2.has(f.id)),
      array.map(f => f.feature)
    );

  // We gaan hier wat valsspelen in de zin dat we een mutable Map gebruiken als
  // accumulator voor de scan. Maar alles voor performantie! (We hebben geen
  // persistente Map in Typescript)
  const geselecteerdeFeatures$ = scan2(
    addedFeature$,
    removedFeature$,
    (state, addedFeature) => {
      const featuresInLaag = state.featuresPerLaag.get(addedFeature.laagnaam);
      if (featuresInLaag) {
        featuresInLaag.set(addedFeature.id, addedFeature);
      } else {
        const featuresInLaag = new Map<string, FeatureWithIdAndLaagnaam>();
        featuresInLaag.set(addedFeature.id, addedFeature);
        state.featuresPerLaag.set(addedFeature.laagnaam, featuresInLaag);
      }
      state.added.set(addedFeature.id, addedFeature);
      state.removed.delete(addedFeature.id);
      return state;
    },
    (state, removedFeature) => {
      const featuresInLaag = state.featuresPerLaag.get(removedFeature.laagnaam);
      if (featuresInLaag) {
        featuresInLaag.delete(removedFeature.id);
      }
      state.added.delete(removedFeature.id);
      state.removed.set(removedFeature.id, removedFeature);
      return state;
    },
    {
      featuresPerLaag: new Map<string, Map<string, FeatureWithIdAndLaagnaam>>(),
      added: new Map<string, FeatureWithIdAndLaagnaam>(),
      removed: new Map<string, FeatureWithIdAndLaagnaam>()
    }
  ).pipe(
    debounceTime(featureSelectionUpdateInterval),
    startWith({
      featuresPerLaag: new Map<string, Map<string, FeatureWithIdAndLaagnaam>>(),
      added: new Map<string, FeatureWithIdAndLaagnaam>(), // toegevoegd en nog steeds aanwezig
      removed: new Map<string, FeatureWithIdAndLaagnaam>() // verwijderd en niet meer toegevoegd
    }),
    map(state => ({
      // We hebben tot nu tot met mutable structuren gewerkt, maar om de
      // toegevoegde en verwijderde features te berekenen in pairwise, moeten we
      // vergelijken en daarvoor kunnen we niet dezelfde instantie gebruiken. Er
      // is een alternatief waarbij we de added en removed resetten in sync met
      // de debounce van de featurewijzigingen, maar dat is veel complexer. Nog
      // een andere mogelijkheid is om een deep copy van de maps te doen en die
      // dan te vergelijken, maar ook dat is ingewikkelder en niet veel sneller.
      // Wat ook zou kunnen is om de array in geselecteerd te gebruiken om een
      // diff te berekenen, maar dan moet we arrays vergelijken ipv Maps, dus
      // ook een orde trager.
      featuresPerLaag: state.featuresPerLaag,
      added: new Map<string, FeatureWithIdAndLaagnaam>(state.added.entries()),
      removed: new Map<string, FeatureWithIdAndLaagnaam>(state.removed.entries())
    })),
    pairwise(),
    map(([prev, current]) => ({
      geselecteerd: featuresOpLaagToArray(current.featuresPerLaag),
      featuresPerLaag: current.featuresPerLaag, // we laten een mutable map los in de wereld :-(
      toegevoegd: difference(current.added, prev.added),
      verwijderd: difference(current.removed, prev.removed)
    })),
    share()
  );

  const hoverFeatures$ = observableFromOlEvents<ol.Collection.Event>(model.hoverFeatures, "add", "remove").pipe(
    map(event => ({
      hover: event.type === "add" ? right<ol.Feature, ol.Feature>(event.element) : left<ol.Feature, ol.Feature>(event.element)
    }))
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

  const zoombereik$ = changer.zoombereikChangeSubj;

  const viewinstellingen$ = rx.merge(viewportSize$, resize$, center$, numlayers$, zoom$, rotation$, zoombereik$).pipe(
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

  const lagenOpGroep$ = {
    Achtergrond: changer.lagenOpGroepSubj.Achtergrond.pipe(observeOn(rx.asapScheduler)),
    "Voorgrond.Hoog": changer.lagenOpGroepSubj["Voorgrond.Hoog"].pipe(observeOn(rx.asapScheduler)),
    "Voorgrond.Laag": changer.lagenOpGroepSubj["Voorgrond.Laag"].pipe(observeOn(rx.asapScheduler)),
    Tools: changer.lagenOpGroepSubj.Tools.pipe(observeOn(rx.asapScheduler))
  };
  const filterVectorLagen = (tlgn: ke.ToegevoegdeLaag[]) => tlgn.filter(ke.isToegevoegdeVectorLaag);
  const vectorlagen$ = lagenOpGroep$["Voorgrond.Hoog"].pipe(map(filterVectorLagen));

  // Om te weten welke features er zichtbaar zijn op een pagina zou het voldoende moeten zijn om te weten welke lagen er zijn, welke van
  // die lagen zichtbaar zijn en welke features er op de lagen in de huidige extent staan. Op zich is dat ook zo, maar het probleem is
  // dat openlayers features ophaalt in de achtergrond. Wanneer je naar een bepaalde extent gaat, zal er direct een event uit de
  // viewinstellingen$ komen, maar de features zelf zijn er op dat moment nog niet noodzakelijk. De call naar getFeaturesInExtent zal dan
  // te weinig resultaten opleveren. Daarom voegen we nog een extra event toe wanneer openlayers klaar is met laden.
  // We gebruiker de addfeature en removefeature, and clear triggers. Het interesseert ons daarbij niet wat de features zijn. Het is ons
  // enkel te doen om te weten dat er veranderingen zijn (de generieke change event op zich blijkt geen events te genereren).
  // Implementatienota: doordat alles via observables gaat (en de switchMap), worden de unsubscribes naar OL doorgespeeld.
  const featuresChanged$: rx.Observable<void> = vectorlagen$.pipe(
    debounceTime(100), // vlugge verandering van het aantal vectorlagen willen we niet zien
    switchMap(vlgn => rx.merge(...vlgn.map(ke.ToegevoegdeVectorLaag.featuresChanged$))),
    // Vlugge veranderingen van de features willen we ook niet zien.
    // Best om dit groter te houden dan de tijd voorzien om cleanup te doen. Anders overbodige events.
    debounceTime(150),
    mapTo(void 0)
  );

  const collectFeaturesPerLaag = (vw: prt.Viewinstellingen, tvlgn: ke.ToegevoegdeVectorLaag[]): ReadonlyMap<string, ol.Feature[]> =>
    new Map(
      pipe(
        tvlgn,
        array.filter(ke.isZichtbaar(vw.resolution)),
        array.map(
          (tvlg: ke.ToegevoegdeVectorLaag) => [tvlg.titel, tvlg.layer.getSource().getFeaturesInExtent(vw.extent)] as [string, ol.Feature[]]
        )
      )
    );

  const zichtbareFeaturesPerLaag$: rx.Observable<ReadonlyMap<string, ol.Feature[]>> = rx
    .combineLatest(viewinstellingen$, vectorlagen$, featuresChanged$, collectFeaturesPerLaag)
    .pipe(share());

  const zichtbareFeatures$: rx.Observable<ol.Feature[]> = zichtbareFeaturesPerLaag$.pipe(
    map(flow(
      m => [...m.values()],
      array.flatten
    ) as ((value: ReadonlyMap<string, ol.Feature[]>) => ol.Feature[]))
  );

  const kaartKlikLocatie$ = observableFromOlEvents(model.map, "click").pipe(
    map((event: ol.MapBrowserEvent) => ({
      coordinate: roundCoordinate(event.coordinate, 2),
      coversFeature: model.map.hasFeatureAtPixel(event.pixel, {
        hitTolerance: envParams(model.config).clickHitTolerance,
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
  // geobserveerd is (of beter, kan geobserveerd zijn). Dit is verwant met het async posten op het model subject.
  return {
    uiElementSelectie$: changer.uiElementSelectieSubj.pipe(observeAsapOnAngular(zone)),
    optiesOpUiElement$: changer.optiesOpUiElementSubj.pipe(observeAsapOnAngular(zone)),
    laagVerwijderd$: changer.laagVerwijderdSubj.pipe(observeAsapOnAngular(zone)),
    viewinstellingen$: viewinstellingen$.pipe(observeAsapOnAngular(zone)),
    laagTabelExtaKnopKlikken$: changer.laagTabelExtaKnopKlikkenSubj.pipe(observeAsapOnAngular(zone)),
    lagenOpGroep: lagenOpGroep$,
    geselecteerdeFeatures$: geselecteerdeFeatures$.pipe(observeAsapOnAngular(zone)),
    hoverFeatures$: hoverFeatures$.pipe(observeAsapOnAngular(zone)),
    zichtbareFeatures$: zichtbareFeatures$.pipe(observeAsapOnAngular(zone)),
    zichtbareFeaturesPerLaag$: zichtbareFeaturesPerLaag$.pipe(observeAsapOnAngular(zone)),
    kaartKlikLocatie$: kaartKlikLocatie$.pipe(observeAsapOnAngular(zone)),
    mijnLocatieZoomDoel$: changer.mijnLocatieZoomDoelSubj.pipe(observeAsapOnAngular(zone)),
    actieveModus$: changer.actieveModusSubj.pipe(observeAsapOnAngular(zone)),
    zoekerServices$: changer.zoekerServicesSubj.pipe(observeAsapOnAngular(zone)),
    zoekresultaten$: zoekresultaten$.pipe(observeAsapOnAngular(zone)),
    zoekresultaatselectie$: changer.zoekresultaatselectieSubj.pipe(observeAsapOnAngular(zone)),
    laagLocationInfoServicesOpTitel$: changer.laagLocationInfoServicesOpTitelSubj.pipe(observeAsapOnAngular(zone)),
    laagstijlaanpassingState$: changer.laagstijlaanpassingStateSubj.pipe(observeAsapOnAngular(zone)),
    laagstijlGezet$: changer.laagstijlGezetSubj.pipe(observeAsapOnAngular(zone)),
    laagfilteraanpassingState$: changer.laagfilteraanpassingStateSubj.pipe(observeAsapOnAngular(zone)),
    transparantieaanpassingState$: changer.transparantieAanpassingStateSubj.pipe(observeAsapOnAngular(zone)),
    laagfilterGezet$: changer.laagfilterGezetSubj.pipe(observeAsapOnAngular(zone)),
    dragInfo$: dragInfo$.pipe(observeAsapOnAngular(zone)),
    rotatie$: rotation$.pipe(observeAsapOnAngular(zone)),
    tekenenOps$: changer.tekenenOpsSubj.pipe(observeAsapOnAngular(zone)),
    getekendeGeometry$: changer.getekendeGeometrySubj.pipe(observeAsapOnAngular(zone)),
    precacheProgress$: changer.precacheProgressSubj.pipe(observeAsapOnAngular(zone)),
    laatsteCacheRefresh$: changer.laatsteCacheRefreshSubj.pipe(observeAsapOnAngular(zone)),
    tabelActiviteit$: changer.tabelActiviteitSubj.pipe(observeAsapOnAngular(zone)),
    tabelLaagInstellingen$: changer.tabelLaagInstellingenSubj.pipe(observeAsapOnAngular(zone)),
    mijnLocatieStateChange$: changer.mijnLocatieStateChangeSubj.pipe(observeAsapOnAngular(zone)),
    dataloadBusy$: changer.dataloadBusySubj.pipe(observeAsapOnAngular(zone)),
    forceProgressBar$: changer.forceProgressBarSubj.pipe(observeAsapOnAngular(zone)),
    inError$: changer.inErrorSubj.pipe(observeAsapOnAngular(zone)),
    collapseUIRequest$: changer.collapseUIRequestSubj.pipe(observeAsapOnAngular(zone))
  };
};
