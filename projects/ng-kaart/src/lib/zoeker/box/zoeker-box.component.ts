import { animate, style, transition, trigger } from "@angular/animations";
import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectorRef, Component, ElementRef, Inject, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { concat, Function1, Function2, identity, Predicate } from "fp-ts/lib/function";
import { fromNullable, fromPredicate, none, Option, some } from "fp-ts/lib/Option";
import { Ord } from "fp-ts/lib/Ord";
import * as ord from "fp-ts/lib/Ord";
import { setoidString } from "fp-ts/lib/Setoid";
import { insert, lookup, remove, StrMap } from "fp-ts/lib/StrMap";
import { Tuple } from "fp-ts/lib/Tuple";
import { List, Map, OrderedMap, Set } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import {
  catchError,
  debounceTime,
  delay,
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap
} from "rxjs/operators";

import { KaartChildComponentBase } from "../../kaart/kaart-child-component-base";
import { VeldInfo } from "../../kaart/kaart-elementen";
import * as ke from "../../kaart/kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { KaartComponent } from "../../kaart/kaart.component";
import { kaartLogger } from "../../kaart/log";
import { matchGeometryType } from "../../util/geometries";
import { collect, Pipeable } from "../../util/operators";
import { forEach } from "../../util/option";
import { minLength } from "../../util/string";
import {
  emptyPrioriteitenOpZoekertype,
  IconDescription,
  StringZoekInput,
  UrlZoekInput,
  ZoekerMetPrioriteiten,
  ZoekInput,
  ZoekKaartResultaat,
  ZoekResultaat,
  zoekResultaatOrdering,
  ZoekResultaten,
  Zoektype
} from "../zoeker";
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE } from "../zoeker-representatie.service";

export const ZoekerUiSelector = "Zoeker";

export class Fout {
  constructor(readonly zoeker: string, readonly fout: string) {}
}

export interface HuidigeSelectie {
  feature: ol.Feature;
  zoekResultaat: ZoekKaartResultaat;
}

export type ZoekerType = typeof BASIS | typeof PERCEEL | typeof CRAB | typeof EXTERNE_WMS;

export const BASIS = "Basis";
export const PERCEEL = "Perceel";
export const CRAB = "Crab";
export const EXTERNE_WMS = "ExterneWms";

type ZoekerPrioriteitenOpZoekernaam = StrMap<StrMap<number>>;

// Vreemde manier van werken, maar constructor heeft een type nodig
const emptyZoekerPrioriteitenOpZoekernaam: ZoekerPrioriteitenOpZoekernaam = remove(
  "dummy",
  new StrMap({ dummy: emptyPrioriteitenOpZoekertype })
);

const zoekresultatenVanType: Function2<Zoektype, ZoekResultaten, Option<ZoekResultaten>> = (zoektype, zoekResultaten) =>
  fromPredicate<ZoekResultaten>(res => res.zoektype === zoektype)(zoekResultaten);

const heeftPrioriteit: Function1<ZoekerPrioriteitenOpZoekernaam, Predicate<ZoekResultaten>> = prioriteitenOpNaam => resultaten =>
  lookup(resultaten.zoeker, prioriteitenOpNaam).exists(prios => lookup(resultaten.zoektype, prios).isSome());

const prioriteitVoorZoekerNaam: Function1<
  Zoektype,
  Function2<ZoekerPrioriteitenOpZoekernaam, number, Function1<string, number>>
> = zoektype => (prioriteitenOpNaam, stdPrio) => zoekernaam =>
  lookup(zoekernaam, prioriteitenOpNaam)
    .chain(priosOpType => lookup(zoektype, priosOpType))
    .getOrElse(stdPrio);

const prioriteitVoorZoekresultaten: Function1<
  Zoektype,
  Function2<ZoekerPrioriteitenOpZoekernaam, number, Function1<ZoekResultaten, number>>
> = zoektype => (prioriteitenOpNaam, stdPrio) => resultaten =>
  prioriteitVoorZoekerNaam(zoektype)(prioriteitenOpNaam, stdPrio)(resultaten.zoeker);

const prioriteitVoorZoekresultaat: Function1<
  Zoektype,
  Function2<ZoekerPrioriteitenOpZoekernaam, number, Function1<ZoekResultaat, number>>
> = zoektype => (prioriteitenOpNaam, stdPrio) => resultaat =>
  prioriteitVoorZoekerNaam(zoektype)(prioriteitenOpNaam, stdPrio)(resultaat.zoeker);

export function isNotNullObject(object) {
  return object && object instanceof Object;
}

export function toTrimmedLowerCasedString(s: string): string {
  return s
    ? s
        .toString()
        .trim()
        .toLocaleLowerCase()
    : "";
}

export function toNonEmptyDistinctLowercaseString(): Pipeable<any, string> {
  return o =>
    o.pipe(
      filter(value => value), // filter de lege waardes eruit
      // zorg dat we een lowercase waarde hebben zonder leading of trailing spaties.
      map(toTrimmedLowerCasedString),
      distinctUntilChanged()
    );
}

export abstract class GetraptZoekerComponent extends KaartChildComponentBase {
  protected constructor(kaartComponent: KaartComponent, private zoekerComponent: ZoekerBoxComponent, zone: NgZone) {
    super(kaartComponent, zone);
  }

  maakVeldenLeeg(vanafNiveau: number) {
    this.zoekerComponent.maakResultaatLeeg();
  }

  protected meldFout(fout: HttpErrorResponse) {
    kaartLogger.error("error", fout);
    this.dispatch(prt.MeldComponentFoutCmd(List.of("Fout bij ophalen perceel gegevens", fout.message)));
  }

  protected subscribeToDisableWhenEmpty<T>(observable: rx.Observable<T[]>, control: FormControl, maakLeegVanaf: number) {
    // Wanneer de array leeg is, disable de control, enable indien niet leeg of er een filter is opgegeven.
    function disableWanneerLeeg(array: T[]) {
      if (array.length > 0 || (control.value && control.value !== "")) {
        control.enable();
      } else {
        control.disable();
      }
    }

    this.bindToLifeCycle(observable).subscribe(
      waardes => {
        disableWanneerLeeg(waardes);
        this.maakVeldenLeeg(maakLeegVanaf);
      },
      error => this.meldFout(error)
    );
  }

  protected busy<T>(observable: rx.Observable<T>): rx.Observable<T> {
    function noop(t: T) {}

    this.zoekerComponent.increaseBusy();
    return observable.pipe(
      take(1),
      tap(noop, () => this.zoekerComponent.decreaseBusy(), () => this.zoekerComponent.decreaseBusy())
    );
  }

  protected zoek<I extends ZoekInput>(zoekInput: I, zoekers: Array<string>) {
    this.zoekerComponent.toonResultaat = true;
    this.zoekerComponent.toonSuggesties = false;
    this.zoekerComponent.increaseBusy();
    this.dispatch({
      type: "Zoek",
      opdracht: { zoekpatroon: zoekInput, zoektype: "Volledig", zoekernamen: zoekers },
      wrapper: kaartLogOnlyWrapper
    });
  }

  // Gebruik de waarde van de VORIGE control om een request te doen,
  //   maar alleen als die vorige waarde een object was (dus door de gebruiker aangeklikt in de lijst).
  // Filter het antwoord daarvan met de (eventuele) waarde van onze HUIDIGE control, dit om autocomplete te doen.
  protected autocomplete<T, A>(
    vorige: FormControl,
    provider: (A) => rx.Observable<T[]>,
    huidige: FormControl,
    propertyGetter: (T) => string
  ): rx.Observable<T[]> {
    // Filter een array van waardes met de waarde van een filter (control), de filter kan een string of een object zijn.
    function filterMetWaarde(): Pipeable<T[], T[]> {
      return (ts$: rx.Observable<T[]>) =>
        rx.combineLatest(
          ts$,
          huidige.valueChanges.pipe(
            startWith<string | T>(""),
            distinctUntilChanged()
          ),
          (waardes, filterWaarde) => {
            if (!filterWaarde) {
              return waardes;
            } else if (typeof filterWaarde === "string") {
              const filterWaardeLowerCase = filterWaarde.toLocaleLowerCase();
              return waardes
                .filter(value =>
                  propertyGetter(value)
                    .toLocaleLowerCase()
                    .includes(filterWaardeLowerCase)
                )
                .sort((a, b) => {
                  const aValueLowerCase = propertyGetter(a).toLocaleLowerCase();
                  const bValueLowerCase = propertyGetter(b).toLocaleLowerCase();

                  const aIndex = aValueLowerCase.indexOf(filterWaardeLowerCase);
                  const bIndex = bValueLowerCase.indexOf(filterWaardeLowerCase);

                  // aIndex en bIndex zullen nooit -1 zijn.
                  // De filter van hierboven vereist dat xValueLowercase.includes(filterWaardeLowerCase)
                  if (aIndex < bIndex) {
                    // de filterwaarde komt korter vooraan voor in a dan in b
                    return -1;
                  } else if (aIndex > bIndex) {
                    // de filterwaarde komt verder achteraan voor in a dan in b
                    return 1;
                  } else {
                    // alfabetisch sorteren van alle andere gevallen
                    return aValueLowerCase.localeCompare(bValueLowerCase);
                  }
                });
            } else {
              return waardes.filter(value =>
                propertyGetter(value)
                  .toLocaleLowerCase()
                  .includes(propertyGetter(filterWaarde).toLocaleLowerCase())
              );
            }
          }
        );
    }

    return vorige.valueChanges.pipe(
      distinctUntilChanged(),
      this.safeProvider(provider),
      filterMetWaarde(),
      shareReplay(1)
    );
  }

  // inputWaarde kan een string of een object zijn. Enkel wanneer het een object is, roepen we de provider op,
  // anders geven we een lege array terug.
  private safeProvider<A, T>(provider: Function1<A, rx.Observable<T[]>>): Pipeable<A, T[]> {
    return switchMap(inputWaarde => {
      return isNotNullObject(inputWaarde)
        ? this.busy(provider(inputWaarde)).pipe(
            catchError(error => {
              this.meldFout(error);
              return rx.of([]);
            })
          )
        : rx.of([]);
    });
  }
}

@Component({
  selector: "awv-zoeker",
  templateUrl: "./zoeker-box.component.html",
  styleUrls: ["./zoeker-box.component.scss"],
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 1, "max-height": "400px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "400px" }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None
})
export class ZoekerBoxComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  zoekVeld = new FormControl();
  @ViewChild("zoekVeldElement")
  zoekVeldElement: ElementRef;

  @ViewChild("zoekerPerceelGetrapt")
  set setZoekerPerceelGetraptComponent(zoekerPerceelGetrapt: GetraptZoekerComponent) {
    this.zoekerComponentSubj.next(new Tuple<ZoekerType, GetraptZoekerComponent>(PERCEEL, zoekerPerceelGetrapt));
  }

  @ViewChild("zoekerCrabGetrapt")
  set setZoekerCrabGetraptComponent(zoekerCrabGetrapt: GetraptZoekerComponent) {
    this.zoekerComponentSubj.next(new Tuple<ZoekerType, GetraptZoekerComponent>(CRAB, zoekerCrabGetrapt));
  }

  @ViewChild("zoekerExterneWmsGetrapt")
  set setZoekerExterneWmsGetraptComponent(zoekerExterneWmsGetrapt: GetraptZoekerComponent) {
    this.zoekerComponentSubj.next(new Tuple<ZoekerType, GetraptZoekerComponent>(EXTERNE_WMS, zoekerExterneWmsGetrapt));
  }

  featuresByResultaat = Map<ZoekResultaat, ol.Feature[]>();
  huidigeSelectie: Option<HuidigeSelectie> = none;
  alleZoekResultaten: ZoekResultaat[] = [];
  alleSuggestiesResultaten: ZoekResultaat[] = [];
  private suggestiesBuffer: ZoekResultaten[] = [];
  alleFouten: Fout[] = [];
  legende: Map<string, IconDescription> = Map<string, IconDescription>();
  legendeKeys: string[] = [];
  toonHelp = false;
  toonResultaat = true;
  toonSuggesties = true;
  busy = 0;
  actieveZoeker: ZoekerType = "Basis";
  perceelMaakLeegDisabled = true;
  crabMaakLeegDisabled = true;
  zoekerMaakLeegDisabled = Set<ZoekerType>();
  externeWmsMaakLeegDisabled = true;
  private readonly zoekerComponentSubj: rx.Subject<Tuple<ZoekerType, GetraptZoekerComponent>> = new rx.Subject();
  private readonly zoekerComponentOpNaam$: rx.Observable<Map<ZoekerType, GetraptZoekerComponent>>;
  private readonly maakVeldenLeegSubj: rx.Subject<ZoekerType> = new rx.Subject<ZoekerType>();
  private readonly zoekers$: rx.Observable<ZoekerMetPrioriteiten[]>;
  private readonly zoekerNamen$: rx.Observable<string[]>;
  private readonly zoekInputSubj: rx.Subject<string> = new rx.Subject<string>();
  private readonly volledigeZoekSubj: rx.Subject<void> = new rx.Subject<void>();

  // Member variabelen die eigenlijk constanten of statics zouden kunnen zijn, maar gebruikt in de HTML template
  readonly Basis: ZoekerType = BASIS;
  readonly Crab: ZoekerType = CRAB;
  readonly Perceel: ZoekerType = PERCEEL;
  readonly ExterneWms: ZoekerType = EXTERNE_WMS;

  private static createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: ZoekerUiSelector,
      source: new ol.source.Vector(),
      styleSelector: none,
      styleSelectorBron: none,
      selectieStyleSelector: none,
      hoverStyleSelector: none,
      selecteerbaar: false,
      hover: false,
      minZoom: 2,
      maxZoom: 15,
      offsetveld: none,
      velden: OrderedMap<string, VeldInfo>(),
      verwijderd: false
    };
  }

  private static maakNieuwFeature(resultaat: ZoekResultaat): ol.Feature[] {
    function multiLineStringMiddlePoint(geometry: ol.geom.MultiLineString): ol.geom.Point {
      // voeg een puntelement toe ergens op de linestring om een icoon met nummer te tonen
      const lineStrings = geometry.getLineStrings();
      const lineString = lineStrings[Math.floor(lineStrings.length / 2)];
      return new ol.geom.Point(lineString.getCoordinateAt(0.5));
    }

    function polygonMiddlePoint(geometry: ol.geom.Geometry): ol.geom.Point {
      // in midden van gemeente polygon
      const extent = geometry.getExtent();
      return new ol.geom.Point([(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]);
    }

    function createMiddlePointFeature(middlePoint: ol.geom.Point): ol.Feature {
      const middlePointFeature = new ol.Feature({
        data: resultaat,
        geometry: middlePoint,
        name: resultaat.omschrijving
      });
      resultaat.kaartInfo.map(kaartInfo => middlePointFeature.setStyle(kaartInfo.style));
      return middlePointFeature;
    }

    function createFeature(geometry: ol.geom.Geometry): ol.Feature {
      const feature = new ol.Feature({
        data: resultaat,
        geometry: geometry,
        name: resultaat.omschrijving
      });
      feature.setId(resultaat.bron + "_" + resultaat.featureIdSuffix);
      resultaat.kaartInfo.map(kaartInfo => feature.setStyle(kaartInfo.style));
      return feature;
    }

    function createFeatureAndMiddlePoint(geometry: ol.geom.Geometry): ol.Feature[] {
      return matchGeometryType(geometry, {
        multiLineString: multiLineStringMiddlePoint,
        polygon: polygonMiddlePoint,
        multiPolygon: polygonMiddlePoint
      }).foldL(() => [createFeature(geometry)], middlePoint => [createFeature(geometry), createMiddlePointFeature(middlePoint)]);
    }

    return resultaat.kaartInfo.fold([], kaartInfo => createFeatureAndMiddlePoint(kaartInfo.geometry));
  }

  constructor(
    parent: KaartComponent,
    zone: NgZone,
    private readonly cd: ChangeDetectorRef,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    super(parent, zone);

    this.zoekers$ = parent.modelChanges.zoekerServices$;
    this.zoekerNamen$ = this.zoekers$.pipe(
      map(svcs => svcs.map(svc => svc.zoeker.naam())),
      debounceTime(250),
      shareReplay(1)
    );
    this.zoekerComponentOpNaam$ = this.zoekerComponentSubj.pipe(
      scan(
        (zoekerComponentOpNaam: Map<ZoekerType, GetraptZoekerComponent>, nz: Tuple<ZoekerType, GetraptZoekerComponent>) =>
          zoekerComponentOpNaam.set(nz.fst, nz.snd),
        Map<ZoekerType, GetraptZoekerComponent>()
      ),
      shareReplay(1)
    );

    // Luister naar de "leegmaken" opdracht en voer uit
    this.bindToLifeCycle(
      this.zoekerComponentOpNaam$.pipe(switchMap(zcon => this.maakVeldenLeegSubj.pipe(collect((naam: ZoekerType) => zcon.get(naam)))))
    ).subscribe(zoekerGetraptComponent => zoekerGetraptComponent.maakVeldenLeeg(0));

    // Luister op zoekresultaten en doe er iets mee
    const prioriteitenOpNaam$: rx.Observable<ZoekerPrioriteitenOpZoekernaam> = this.zoekers$.pipe(
      map(zmps =>
        zmps.reduce((priosOpNaam, zmp) => insert(zmp.zoeker.naam(), zmp.prioriteiten, priosOpNaam), emptyZoekerPrioriteitenOpZoekernaam)
      )
    );
    this.bindToLifeCycle(
      prioriteitenOpNaam$.pipe(
        switchMap(prioriteitenOpNaam =>
          parent.modelChanges.zoekresultaten$.pipe(map(zoekresultaten => new Tuple(zoekresultaten, prioriteitenOpNaam)))
        )
      )
    ).subscribe(t => this.processZoekerAntwoord(t.fst, t.snd));
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.dispatch({
      type: "VoegLaagToe",
      positie: 1,
      laag: ZoekerBoxComponent.createLayer(),
      magGetoondWorden: true,
      laaggroep: "Tools",
      legende: none,
      stijlInLagenKiezer: none,
      wrapper: kaartLogOnlyWrapper
    });
    const minZoektermLength = 2;
    const suggestieDelay = 250;
    const startZoek$ = this.volledigeZoekSubj.asObservable();
    const laatSuggestiesToe$ = rx
      .merge(
        rx.of(true), // laat initieel toe
        startZoek$.pipe(mapTo(false)), // laat niet toe direct na een start zoek opdracht (enter)
        startZoek$.pipe(
          mapTo(true),
          delay(suggestieDelay + 100)
        ) // totdat er wat tijd verlopen is. Moet na emit van recentste zoekterm!
      )
      .pipe(shareReplay(1)); // zorg ervoor dat subscribers steeds de recentste waarde krijgen
    const zoekterm$ = this.zoekInputSubj.pipe(
      debounceTime(suggestieDelay), // Niet elk karakter als er vlug getypt wordt
      map(s => s.trimLeft()), // Spaties links boeien ons niet
      distinctUntilChanged() // Evt een karakter + delete, of een control character
    );
    const zoektermToZoekpatroon: Function1<string, ZoekInput> = zoekterm => {
      if (zoekterm.startsWith("http")) {
        return UrlZoekInput(zoekterm);
      } else {
        return StringZoekInput(zoekterm);
      }
    };
    // Zorg ervoor dat suggesties opgevraagd worden zodra er een voldoende lange zoekterm ingegeven wordt
    this.bindToLifeCycle(
      rx.combineLatest(
        this.zoekerNamen$, // In theorie ook zoeken wanneer er nieuwe zoekers geregistreerd worden. In de praktijk gebeurt dat niet
        zoekterm$.pipe(filter(minLength(minZoektermLength))), // Enkel emitten wanneer zoekterm minimale lengte heeft,
        (zoekerNamen, zoekterm) =>
          ({
            type: "Zoek",
            opdracht: { zoektype: "Suggesties", zoekernamen: zoekerNamen, zoekpatroon: zoektermToZoekpatroon(zoekterm) },
            wrapper: kaartLogOnlyWrapper
          } as prt.ZoekCmd<KaartInternalMsg>)
      )
    )
      .pipe(
        switchMap(cmd =>
          laatSuggestiesToe$.pipe(
            take(1),
            filter(identity), // emit cmd max 1x: wanneer toegelaten
            mapTo(cmd)
          )
        )
      )
      .subscribe(cmd => {
        this.suggestiesBuffer = [];
        this.dispatch(cmd);
      });

    // zorg ervoor dat de volledige zoekopdracht uitgevoerd wordt op het moment dat de opdracht gegeven wordt
    this.bindToLifeCycle(
      rx
        .combineLatest(
          this.zoekerNamen$,
          this.zoekInputSubj, // ipv zoekTerm$, want anders zoeken op woord dat 250ms onveranderd is gebleven -> probleem bij snelle enter
          (zoekerNamen, zoekterm) =>
            ({
              type: "Zoek",
              opdracht: { zoektype: "Volledig", zoekernamen: zoekerNamen, zoekpatroon: zoektermToZoekpatroon(zoekterm) },
              wrapper: kaartLogOnlyWrapper
            } as prt.ZoekCmd<KaartInternalMsg>)
        )
        .pipe(
          switchMap(
            cmd => this.volledigeZoekSubj.pipe(mapTo(cmd)) // Via switchmap ipv in combineLatest anders wordt bij elke letter gezocht
          )
        )
    ).subscribe(cmd => {
      this.toonResultaat = true;
      this.toonSuggesties = false;
      this.increaseBusy();
      this.dispatch(cmd);
    });

    // zorg ervoor dat de suggestiebox (on)zichtbaar is naar gelang de lengte van de zoekterm
    const suggestieBoxZichtbaarheid$ = zoekterm$.pipe(map(minLength(minZoektermLength))); // enkel obv getypte characters
    this.bindToLifeCycle(suggestieBoxZichtbaarheid$).subscribe(visible => (this.toonSuggesties = visible));
  }

  ngOnDestroy(): void {
    this.dispatch(prt.VerwijderLaagCmd(ZoekerUiSelector, kaartLogOnlyWrapper));
    super.ngOnDestroy();
  }

  protected refreshUI(): void {
    this.cd.detectChanges();
  }

  toggleResultaat() {
    this.toonResultaat = !this.toonResultaat;
    this.refreshUI();
  }

  toggleHelp() {
    this.toonHelp = !this.toonHelp;
    this.refreshUI();
  }

  kiesZoekResultaat(resultaat: ZoekResultaat) {
    this.zoomNaarResultaat(resultaat);
  }

  kiesSuggestiesResultaat(resultaat: ZoekResultaat) {
    this.zoomNaarSuggestie(resultaat);
    this.zoekVeld.setValue(resultaat.omschrijving);
    this.focusOpZoekVeld();
  }

  private zoomNaarResultaat(resultaat: ZoekResultaat) {
    this.toonResultaat = false;
    this.toonHelp = false;
    this.dispatch(prt.ZoekGekliktCmd(resultaat));
    forEach(
      resultaat.kaartInfo.filter(info => !ol.extent.isEmpty(info.extent)), //
      info => {
        this.dispatch(prt.VeranderExtentCmd(info.geometry.getExtent()));
        if (info.geometry.getType() === "Point") {
          resultaat.preferredPointZoomLevel.map(zoom => this.dispatch(prt.VeranderZoomCmd(zoom, kaartLogOnlyWrapper)));
        }
        const features = fromNullable(this.featuresByResultaat.get(resultaat));
        forEach(features.chain(fs => array.index(0, fs)), feat => this.highlight(feat, info));
      }
    );
  }

  private highlight(nieuweFeature: ol.Feature, zoekKaartResultaat: ZoekKaartResultaat) {
    forEach(this.huidigeSelectie, selectie => selectie.feature.setStyle(selectie.zoekResultaat.style));
    nieuweFeature.setStyle(zoekKaartResultaat.highlightStyle);
    this.huidigeSelectie = some({
      feature: nieuweFeature,
      zoekResultaat: zoekKaartResultaat
    });
  }

  private zoomNaarSuggestie(resultaat: ZoekResultaat) {
    this.toonSuggesties = false;
    this.toonResultaat = false;
    this.toonHelp = false;
    this.dispatch(prt.ZoekGekliktCmd(resultaat));
    forEach(
      resultaat.kaartInfo.filter(info => !ol.extent.isEmpty(info.extent)), //
      info => {
        this.dispatch(prt.VeranderExtentCmd(info.geometry.getExtent()));
        if (info.geometry.getType() === "Point") {
          resultaat.preferredPointZoomLevel.map(zoom => this.dispatch(prt.VeranderZoomCmd(zoom, kaartLogOnlyWrapper)));
        }
        const resultaatFeatures = ZoekerBoxComponent.maakNieuwFeature(resultaat);
        this.featuresByResultaat = Map<ZoekResultaat, ol.Feature[]>().set(resultaat, resultaatFeatures);

        this.dispatch(prt.VervangFeaturesCmd(ZoekerUiSelector, List<ol.Feature>(resultaatFeatures), kaartLogOnlyWrapper));

        resultaatFeatures.slice(0, 1).forEach(feature => this.highlight(feature, info));
      }
    );
  }

  kuisZoekOp() {
    this.clearBusy();
    this.maakResultaatLeeg();
    this.focusOpZoekVeld();
  }

  focusOpZoekVeld() {
    setTimeout(() => {
      if (this.actieveZoeker === BASIS) {
        this.zoekVeldElement.nativeElement.focus();
      }
    });
  }

  onKey(event: any) {
    // De gebruiker kan locatie voorstellen krijgen door in het zoekveld min. 2 tekens in te typen en op enter te drukken
    switch (event.key) {
      case "Enter":
        this.zoek(event);
        break;
      case "Escape":
        if (this.toonSuggesties) {
          this.toonSuggesties = false;
        } else {
          this.kuisZoekOp();
        }
    }
    // Een formbuilder heeft een observable ingebouwd, maar dat gebruiken we dus niet
    this.zoekInputSubj.next(event.srcElement.value);
  }

  zoek(event: any) {
    if (event.srcElement.value.length >= 2) {
      this.volledigeZoekSubj.next();
    }
  }

  heeftFout(): boolean {
    return this.alleFouten.length > 0;
  }

  isInklapbaar(): boolean {
    return this.heeftFout() || this.alleZoekResultaten.length > 0 || [PERCEEL, CRAB, EXTERNE_WMS].indexOf(this.actieveZoeker) >= 0;
  }

  kiesZoeker(zoeker: ZoekerType) {
    this.clearBusy();
    this.maakResultaatLeeg();
    this.actieveZoeker = zoeker;
    this.focusOpZoekVeld();
    this.toonResultaat = true;
    this.toonSuggesties = false;
  }

  maakResultaatLeeg() {
    this.zoekVeld.setValue("");
    this.zoekVeld.markAsPristine();
    this.alleFouten = [];
    this.alleZoekResultaten = [];
    this.alleSuggestiesResultaten = [];
    this.suggestiesBuffer = [];
    this.featuresByResultaat = Map<ZoekResultaat, ol.Feature[]>();
    this.huidigeSelectie = none;
    this.legende.clear();
    this.legendeKeys = [];
    this.dispatch(prt.VervangFeaturesCmd(ZoekerUiSelector, List(), kaartLogOnlyWrapper));
  }

  private processZoekerAntwoord(nieuweResultaten: ZoekResultaten, prioriteitenOpNaam: ZoekerPrioriteitenOpZoekernaam): void {
    kaartLogger.debug("Process " + nieuweResultaten.zoeker, nieuweResultaten);
    switch (nieuweResultaten.zoektype) {
      case "Volledig":
        return this.processVolledigZoekerAntwoord(nieuweResultaten, prioriteitenOpNaam);
      case "Suggesties":
        return this.processSuggestiesAntwoord(nieuweResultaten, prioriteitenOpNaam);
    }
  }

  private processVolledigZoekerAntwoord(nieuweResultaten: ZoekResultaten, prioriteitenOpNaam: ZoekerPrioriteitenOpZoekernaam): void {
    this.alleZoekResultaten = this.vervangZoekerResultaten(this.alleZoekResultaten, nieuweResultaten);
    this.alleZoekResultaten.sort(
      zoekResultaatOrdering(this.zoekVeld.value, prioriteitVoorZoekresultaat("Volledig")(prioriteitenOpNaam, 99))
    );
    nieuweResultaten.legende.forEach((safeHtml, name) => this.legende.set(name!, safeHtml!));
    this.alleSuggestiesResultaten = [];
    this.legendeKeys = this.legende.keySeq().toArray();

    this.alleFouten = this.alleFouten
      .filter(resultaat => resultaat.zoeker !== nieuweResultaten.zoeker)
      .concat(nieuweResultaten.fouten.map(fout => new Fout(nieuweResultaten.zoeker, fout)));

    this.featuresByResultaat = this.alleZoekResultaten.reduce(
      (map, resultaat) => map.set(resultaat, ZoekerBoxComponent.maakNieuwFeature(resultaat)),
      Map<ZoekResultaat, ol.Feature[]>()
    );

    this.dispatch(
      prt.VervangFeaturesCmd(
        ZoekerUiSelector,
        this.featuresByResultaat.toList().reduce((list, fs) => list!.push(...fs!), List<ol.Feature>()),
        kaartLogOnlyWrapper
      )
    );
    this.decreaseBusy();
  }

  private processSuggestiesAntwoord(nieuweResultaten: ZoekResultaten, prioriteitenOpNaam: ZoekerPrioriteitenOpZoekernaam): void {
    // de resultaten van de zoeker wiens antwoord nu binnen komt, moeten vervangen worden door de nieuwe resultaten
    // We moeten de resultaten in volgorde van prioriteit tonen

    // Een hulpfunctie die de lokale prioriteitenOpNaam mee neemt.
    const prioriteit: Function1<ZoekResultaten, number> = prioriteitVoorZoekresultaten("Suggesties")(prioriteitenOpNaam, 99);

    // Stap 1 is enkel die resultaten overhouden die van toepassing zijn en een prioriteit hebben
    const weerhoudenResultaten: Option<ZoekResultaten> = zoekresultatenVanType("Suggesties", nieuweResultaten) //
      .filter(heeftPrioriteit(prioriteitenOpNaam));

    forEach(weerhoudenResultaten, resultaten => {
      // Stap 2 is sorteren van de antwoorden van de zoekers op prioriteit
      const ordering: Ord<ZoekResultaten> = ord.contramap(prioriteit, ord.ordNumber);
      this.suggestiesBuffer = array.sort<ZoekResultaten>(ordering)(array.snoc(this.suggestiesBuffer, resultaten));

      // Stap 3 is alle individuele resultaten uit de resultaten halen voor zover de prioriteiten ononderbroken oplopen van 1
      // Het is perfect mogelijk dat er voor een bepaalde prioriteit geen resultaten zijn (lege array). We verwachten dit
      // zelfs van de zoekers: als ze geen resultaten hebben, moeten ze een lege array versturen.
      // En passant zorgen we er voor dat er nooit meer dan 5 suggestieresultaten zijn.
      this.alleSuggestiesResultaten = this.suggestiesBuffer.reduce(
        ({ resultatenVanZoekers, volgendePrio }, suggestieZoekResultaten) => {
          const prioVanResultaten = prioriteit(suggestieZoekResultaten);
          if (prioVanResultaten === volgendePrio || prioVanResultaten === volgendePrio + 1) {
            return {
              resultatenVanZoekers: array.take(5, concat(resultatenVanZoekers, suggestieZoekResultaten.resultaten)),
              volgendePrio: volgendePrio + 1
            };
          } else {
            return { resultatenVanZoekers: resultatenVanZoekers, volgendePrio: 0 };
          }
        },
        {
          resultatenVanZoekers: new Array<ZoekResultaat>(),
          volgendePrio: 0
        }
      ).resultatenVanZoekers;

      this.refreshUI();
    });
  }

  private vervangZoekerResultaten(resultaten: ZoekResultaat[], vervangResultaten: ZoekResultaten) {
    return resultaten.filter(resultaat => resultaat.zoeker !== vervangResultaten.zoeker).concat(vervangResultaten.resultaten);
  }

  increaseBusy() {
    this.busy++;
    this.cd.detectChanges();
  }

  decreaseBusy() {
    if (this.busy > 0) {
      this.busy--;
    }
    this.cd.detectChanges();
  }

  clearBusy() {
    this.busy = 0;
  }

  isBusy(): boolean {
    return this.busy > 0;
  }

  onCrabMaakLeegDisabledChange(maakLeegDisabled: boolean): void {
    setTimeout(() => {
      this.crabMaakLeegDisabled = maakLeegDisabled;
    });
  }

  onPerceelMaakLeegDisabledChange(maakLeegDisabled: boolean): void {
    setTimeout(() => {
      this.perceelMaakLeegDisabled = maakLeegDisabled;
    });
  }

  onMaakLeegDisabledChange(zoekerNaam: ZoekerType, maakLeegDisabled: boolean): void {
    this.zoekerMaakLeegDisabled = maakLeegDisabled
      ? this.zoekerMaakLeegDisabled.add(zoekerNaam)
      : this.zoekerMaakLeegDisabled.remove(zoekerNaam);
  }

  availability$(zoekerNaam: ZoekerType): rx.Observable<boolean> {
    return this.zoekerNamen$.pipe(map(nmn => array.member(setoidString)(nmn, zoekerNaam)));
  }

  maakVeldenLeeg(zoekerNaam: ZoekerType): void {
    this.maakVeldenLeegSubj.next(zoekerNaam);
  }

  isZoekerMaakLeegEnabled(zoekerNaam: ZoekerType) {
    return !this.zoekerMaakLeegDisabled.contains(zoekerNaam);
  }
}
