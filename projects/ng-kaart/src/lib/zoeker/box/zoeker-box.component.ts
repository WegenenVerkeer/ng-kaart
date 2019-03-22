import { animate, style, transition, trigger } from "@angular/animations";
import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectorRef, Component, ElementRef, Inject, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { concat, Function1, Function2, identity, Predicate } from "fp-ts/lib/function";
import * as fpMap from "fp-ts/lib/Map";
import { fromNullable, fromPredicate, none, Option, some } from "fp-ts/lib/Option";
import * as ord from "fp-ts/lib/Ord";
import { Ord } from "fp-ts/lib/Ord";
import { setoidString } from "fp-ts/lib/Setoid";
import { lookup } from "fp-ts/lib/StrMap";
import { Tuple } from "fp-ts/lib/Tuple";
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
import * as ke from "../../kaart/kaart-elementen";
import { VeldInfo } from "../../kaart/kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { KaartComponent } from "../../kaart/kaart.component";
import { kaartLogger } from "../../kaart/log";
import { matchGeometryType } from "../../util/geometries";
import * as maps from "../../util/maps";
import { collect, Pipeable } from "../../util/operators";
import { forEach } from "../../util/option";
import * as sets from "../../util/sets";
import { minLength } from "../../util/string";
import {
  IconDescription,
  StringZoekInput,
  UrlZoekInput,
  Weergaveopties,
  ZoekAntwoord,
  ZoekerMetWeergaveopties,
  ZoekInput,
  ZoekKaartResultaat,
  ZoekResultaat,
  zoekResultaatOrdering,
  Zoektype
} from "../zoeker";

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

type WeergaveoptiesOpZoekernaam = Map<string, Weergaveopties>;

const zoekresultatenVanType: Function2<Zoektype, ZoekAntwoord, Option<ZoekAntwoord>> = (zoektype, zoekResultaten) =>
  fromPredicate<ZoekAntwoord>(res => res.zoektype === zoektype)(zoekResultaten);

const heeftPrioriteit: Function1<WeergaveoptiesOpZoekernaam, Predicate<ZoekAntwoord>> = optiesOpNaam => resultaten =>
  fpMap
    .lookup(setoidString)(resultaten.zoeker, optiesOpNaam)
    .exists(opties => lookup(resultaten.zoektype, opties.prioriteiten).isSome());

const prioriteitVoorZoekerNaam: Function1<
  Zoektype,
  Function2<WeergaveoptiesOpZoekernaam, number, Function1<string, number>>
> = zoektype => (optiesOpNaam, stdPrio) => zoekernaam =>
  fpMap
    .lookup(setoidString)(zoekernaam, optiesOpNaam)
    .chain(opties => lookup(zoektype, opties.prioriteiten))
    .getOrElse(stdPrio);

const prioriteitVoorZoekAntwoord: Function1<
  Zoektype,
  Function2<WeergaveoptiesOpZoekernaam, number, Function1<ZoekAntwoord, number>>
> = zoektype => (optiesOpNaam, stdPrio) => antwoord => prioriteitVoorZoekerNaam(zoektype)(optiesOpNaam, stdPrio)(antwoord.zoeker);

const prioriteitVoorZoekresultaat: Function1<
  Zoektype,
  Function2<WeergaveoptiesOpZoekernaam, number, Function1<ZoekResultaat, number>>
> = zoektype => (optiesOpNaam, stdPrio) => resultaat => prioriteitVoorZoekerNaam(zoektype)(optiesOpNaam, stdPrio)(resultaat.zoeker);

export function isNotNullObject(object: any) {
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
    this.dispatch(prt.MeldComponentFoutCmd(["Fout bij ophalen perceel gegevens", fout.message]));
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

  // Gevaarlijk: de key ZoekResultaat is een record en er wordt op objectreferentie vergeleken. We moeten er dus steeds
  // voor zorgen dat we dezelfde objecten gebruiken om op te zoeken en op te slaan.
  featuresByResultaat = new Map<ZoekResultaat, ol.Feature[]>();
  huidigeSelectie: Option<HuidigeSelectie> = none;
  alleZoekResultaten: ZoekResultaat[] = [];
  alleSuggestiesResultaten: ZoekResultaat[] = [];
  private weergaveoptiesOpZoekernaam: WeergaveoptiesOpZoekernaam = new Map();
  private suggestiesBuffer: ZoekAntwoord[] = [];
  alleFouten: Fout[] = [];
  legende: Map<string, IconDescription> = new Map<string, IconDescription>();
  legendeKeys: string[] = [];
  toonHelp = false;
  toonResultaat = true;
  toonSuggesties = true;
  busy = 0;
  actieveZoeker: ZoekerType = "Basis";
  perceelMaakLeegDisabled = true;
  crabMaakLeegDisabled = true;
  zoekerMaakLeegDisabled = new Set<ZoekerType>();
  externeWmsMaakLeegDisabled = true;
  private readonly zoekerComponentSubj: rx.Subject<Tuple<ZoekerType, GetraptZoekerComponent>> = new rx.Subject();
  private readonly zoekerComponentOpNaam$: rx.Observable<Map<ZoekerType, GetraptZoekerComponent>>;
  private readonly maakVeldenLeegSubj: rx.Subject<ZoekerType> = new rx.Subject<ZoekerType>();
  private readonly zoekers$: rx.Observable<ZoekerMetWeergaveopties[]>;
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
      velden: new Map<string, VeldInfo>(),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false
    };
  }

  private static maakNieuwFeature(resultaat: ZoekResultaat, weergaveOpties: Option<Weergaveopties>): ol.Feature[] {
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

    function circleMiddlePoint(circle: ol.geom.Circle): ol.geom.Point {
      return new ol.geom.Point(circle.getCenter());
    }

    function pointToMiddlePointFeature(middlePoint: ol.geom.Point): ol.Feature {
      const feature = new ol.Feature({
        data: resultaat,
        geometry: middlePoint,
        name: resultaat.omschrijving
      });
      resultaat.kaartInfo.map(kaartInfo => feature.setStyle(kaartInfo.style));
      return feature;
    }

    function createMiddlePointFeature(geometry: ol.geom.Geometry): Option<ol.Feature> {
      return matchGeometryType(geometry, {
        multiLineString: multiLineStringMiddlePoint,
        polygon: polygonMiddlePoint,
        multiPolygon: polygonMiddlePoint,
        circle: circleMiddlePoint
      }).map(pointToMiddlePointFeature);
    }

    function createOutlineFeature(geometry: ol.geom.Geometry): ol.Feature {
      const feature = new ol.Feature({
        data: resultaat,
        geometry: geometry,
        name: resultaat.omschrijving
      });
      feature.setId(resultaat.bron + "_" + resultaat.featureIdSuffix);
      resultaat.kaartInfo.map(kaartInfo => feature.setStyle(kaartInfo.style));
      return feature;
    }

    function createOutlineAndMiddlePointFeatures(geometry: ol.geom.Geometry): ol.Feature[] {
      const middlepointFeature = weergaveOpties.exists(o => o.toonIcoon) ? createMiddlePointFeature(geometry) : none;
      const outlineFeature = weergaveOpties.exists(o => o.toonOppervlak) ? some(createOutlineFeature(geometry)) : none;

      return array.catOptions([middlepointFeature, outlineFeature]);
    }

    return resultaat.kaartInfo.fold([], kaartInfo => createOutlineAndMiddlePointFeatures(kaartInfo.geometry));
  }

  constructor(parent: KaartComponent, zone: NgZone, private readonly cd: ChangeDetectorRef) {
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
        new Map<ZoekerType, GetraptZoekerComponent>()
      ),
      shareReplay(1)
    );

    // Luister naar de "leegmaken" opdracht en voer uit
    this.bindToLifeCycle(
      this.zoekerComponentOpNaam$.pipe(switchMap(zcon => this.maakVeldenLeegSubj.pipe(collect((naam: ZoekerType) => zcon.get(naam)!))))
    ).subscribe(zoekerGetraptComponent => zoekerGetraptComponent.maakVeldenLeeg(0));

    const weergaveoptiesOpZoekernaam$: rx.Observable<WeergaveoptiesOpZoekernaam> = this.zoekers$.pipe(
      map(zmps => maps.toMapByKey(zmps, zmp => zmp.zoeker.naam()))
    );
    // Luister op zoekresultaten en doe er iets mee
    this.bindToLifeCycle(
      weergaveoptiesOpZoekernaam$.pipe(
        tap(weergaveoptiesOpZoekernaam => (this.weergaveoptiesOpZoekernaam = weergaveoptiesOpZoekernaam)),
        switchMap(weergaveoptiesOpZoekernaam =>
          parent.modelChanges.zoekresultaten$.pipe(map(zoekresultaten => new Tuple(zoekresultaten, weergaveoptiesOpZoekernaam)))
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
    const suggestieDelay = 300;
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
      map(s => s.trimLeft()), // Spaties links boeien ons niet, rechts wel want kunnen woordprefix afsluiten
      distinctUntilChanged() // Evt een karakter + delete, of een control character
    );
    const zoektermToZoekpatroon: Function1<string, ZoekInput> = zoekterm => {
      const fixedTerm = zoekterm.trimLeft(); // trim hier dupliceren, want deze functie ook gebruikt op this.zoekInputSubj
      if (fixedTerm.startsWith("http")) {
        return UrlZoekInput(fixedTerm);
      } else {
        return StringZoekInput(fixedTerm);
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
        forEach(features.chain(fs => array.lookup(0, fs)), feat => this.highlight(feat, info));
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
        const resultaatFeatures = ZoekerBoxComponent.maakNieuwFeature(
          resultaat,
          fpMap.lookup(setoidString)(resultaat.zoeker, this.weergaveoptiesOpZoekernaam)
        );
        this.featuresByResultaat = new Map<ZoekResultaat, ol.Feature[]>().set(resultaat, resultaatFeatures);

        this.dispatch(prt.VervangFeaturesCmd(ZoekerUiSelector, resultaatFeatures, kaartLogOnlyWrapper));

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

  keydown(event: any) {
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
        break;
      case "ArrowDown":
        event.preventDefault(); // stop arrow key from scrolling window
        this.setFocusEersteSuggestieOfResultaat();
        break;
      case "ArrowUp":
        event.preventDefault(); // stop arrow key from scrolling window
        this.setFocusLaatsteSuggestieOfResultaat();
        break;
    }
  }

  keyup(event: any) {
    // Een formbuilder heeft een observable ingebouwd, maar dat gebruiken we dus niet
    this.zoekInputSubj.next(event.srcElement.value);
  }

  focusNext(event, isLast: boolean): void {
    event.preventDefault(); // stop arrow key from scrolling window
    if (isLast) {
      this.focusOpZoekVeld();
    } else {
      event.srcElement.nextElementSibling.focus();
    }
  }

  focusPrev(event, isFirst: boolean): void {
    event.preventDefault(); // stop arrow key from scrolling window
    if (isFirst) {
      this.focusOpZoekVeld();
    } else {
      event.srcElement.previousSibling.focus();
    }
  }

  suggestieId(index: number, isFirst: boolean, isLast: boolean): string {
    if (isFirst) {
      return "eersteSuggestie";
    } else if (isLast) {
      return "laatsteSuggestie";
    } else {
      return `suggestie-${index}`;
    }
  }

  resultaatId(index: number, isFirst: boolean, isLast: boolean): string {
    if (isFirst) {
      return "eersteResultaat";
    } else if (isLast) {
      return "laatsteResultaat";
    } else {
      return `resultaat-${index}`;
    }
  }

  setFocusEersteSuggestieOfResultaat(): void {
    const eersteSuggestie = document.getElementById("eersteSuggestie")!;
    const eersteResultaat = document.getElementById("eersteResultaat")!;
    if (eersteSuggestie) {
      eersteSuggestie.focus();
    } else if (eersteResultaat) {
      eersteResultaat.focus();
    }
  }

  setFocusLaatsteSuggestieOfResultaat(): void {
    const laatsteSuggestie = document.getElementById("laatsteSuggestie")!;
    const laatsteResultaat = document.getElementById("laatsteResultaat")!;
    if (laatsteSuggestie) {
      laatsteSuggestie.focus();
    } else if (laatsteResultaat) {
      laatsteResultaat.focus();
    }
  }

  zoek(event: any) {
    if (this.zoekVeld.value.length >= 2) {
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
    this.featuresByResultaat = new Map<ZoekResultaat, ol.Feature[]>();
    this.huidigeSelectie = none;
    this.legende.clear();
    this.legendeKeys = [];
    this.dispatch(prt.VervangFeaturesCmd(ZoekerUiSelector, <ol.Feature[]>[], kaartLogOnlyWrapper));
  }

  private processZoekerAntwoord(nieuweResultaten: ZoekAntwoord, optiesOpNaam: WeergaveoptiesOpZoekernaam): void {
    kaartLogger.debug("Process " + nieuweResultaten.zoeker, nieuweResultaten);
    this.focusOpZoekVeld();
    switch (nieuweResultaten.zoektype) {
      case "Volledig":
        return this.processVolledigZoekerAntwoord(nieuweResultaten, optiesOpNaam);
      case "Suggesties":
        return this.processSuggestiesAntwoord(nieuweResultaten, optiesOpNaam);
    }
  }

  private processVolledigZoekerAntwoord(nieuweResultaten: ZoekAntwoord, optiesOpNaam: WeergaveoptiesOpZoekernaam): void {
    this.alleZoekResultaten = this.vervangZoekerResultaten(this.alleZoekResultaten, nieuweResultaten);
    this.alleZoekResultaten.sort(zoekResultaatOrdering(this.zoekVeld.value, prioriteitVoorZoekresultaat("Volledig")(optiesOpNaam, 99)));
    nieuweResultaten.legende.forEach((safeHtml, name) => this.legende.set(name!, safeHtml!));
    this.alleSuggestiesResultaten = [];
    this.legendeKeys = Array.from(this.legende.keys());

    this.alleFouten = this.alleFouten
      .filter(resultaat => resultaat.zoeker !== nieuweResultaten.zoeker)
      .concat(nieuweResultaten.fouten.map(fout => new Fout(nieuweResultaten.zoeker, fout)));

    this.featuresByResultaat = this.alleZoekResultaten.reduce(
      (map, resultaat) =>
        map.set(resultaat, ZoekerBoxComponent.maakNieuwFeature(resultaat, fpMap.lookup(setoidString)(resultaat.zoeker, optiesOpNaam))),
      new Map<ZoekResultaat, ol.Feature[]>()
    );

    this.dispatch(
      prt.VervangFeaturesCmd(ZoekerUiSelector, array.flatten(Array.from(this.featuresByResultaat.values())), kaartLogOnlyWrapper)
    );
    this.decreaseBusy();
  }

  private processSuggestiesAntwoord(nieuweResultaten: ZoekAntwoord, optiesOpNaam: WeergaveoptiesOpZoekernaam): void {
    // de resultaten van de zoeker wiens antwoord nu binnen komt, moeten vervangen worden door de nieuwe resultaten
    // We moeten de resultaten in volgorde van prioriteit tonen

    // Een hulpfunctie die de lokale optiesOpNaam mee neemt.
    const prioriteit: Function1<ZoekAntwoord, number> = prioriteitVoorZoekAntwoord("Suggesties")(optiesOpNaam, 99);

    // Stap 1 is enkel die resultaten overhouden die van toepassing zijn en een prioriteit hebben
    const weerhoudenResultaten: Option<ZoekAntwoord> = zoekresultatenVanType("Suggesties", nieuweResultaten) //
      .filter(heeftPrioriteit(optiesOpNaam));

    forEach(weerhoudenResultaten, resultaten => {
      // Stap 2 is sorteren van de antwoorden van de zoekers op prioriteit
      const ordering: Ord<ZoekAntwoord> = ord.contramap(prioriteit, ord.ordNumber);
      this.suggestiesBuffer = array.sort<ZoekAntwoord>(ordering)(array.snoc(this.suggestiesBuffer, resultaten));

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

  private vervangZoekerResultaten(resultaten: ZoekResultaat[], vervangResultaten: ZoekAntwoord) {
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
      : sets.removeSimple(this.zoekerMaakLeegDisabled)(zoekerNaam);
  }

  availability$(zoekerNaam: ZoekerType): rx.Observable<boolean> {
    return this.zoekerNamen$.pipe(map(nmn => array.elem(setoidString)(zoekerNaam, nmn)));
  }

  maakVeldenLeeg(zoekerNaam: ZoekerType): void {
    this.maakVeldenLeegSubj.next(zoekerNaam);
  }

  isZoekerMaakLeegEnabled(zoekerNaam: ZoekerType) {
    return !this.zoekerMaakLeegDisabled.has(zoekerNaam);
  }
}
