import { animate, style, transition, trigger } from "@angular/animations";
import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import { none, Option, some } from "fp-ts/lib/Option";
import { List, Map, OrderedMap, Set } from "immutable";
import * as ol from "openlayers";
import { pipe } from "rxjs";
import { UnaryFunction } from "rxjs/interfaces";
import { Observable } from "rxjs/Observable";
import { catchError, combineLatest, distinctUntilChanged, filter, map, shareReplay, startWith, switchMap, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../../kaart/kaart-child-component-base";
import * as ke from "../../kaart/kaart-elementen";
import { VeldInfo } from "../../kaart/kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { KaartComponent } from "../../kaart/kaart.component";
import { kaartLogger } from "../../kaart/log";
import { matchGeometryType } from "../../util/geometries";
import { forEach } from "../../util/option";
import {
  compareResultaten,
  IconDescription,
  StringZoekInput,
  ZoekInput,
  ZoekKaartResultaat,
  ZoekResultaat,
  ZoekResultaten
} from "../zoeker-base";

export const ZoekerUiSelector = "Zoeker";

export class Fout {
  constructor(readonly zoeker: string, readonly fout: string) {}
}

export interface HuidigeSelectie {
  feature: ol.Feature;
  zoekResultaat: ZoekKaartResultaat;
}

export type ZoekerType = "Basis" | "Perceel" | "Crab";

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

export function toNonEmptyDistinctLowercaseString(): UnaryFunction<Observable<any>, Observable<string>> {
  return pipe(
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

  protected subscribeToDisableWhenEmpty<T>(observable: Observable<T[]>, control: FormControl, maakLeegVanaf: number) {
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

  protected busy<T>(observable: Observable<T>): Observable<T> {
    function noop() {}

    this.zoekerComponent.increaseBusy();
    return observable.pipe(tap(noop, () => this.zoekerComponent.decreaseBusy(), () => this.zoekerComponent.decreaseBusy()));
  }

  protected zoek(zoekInput: ZoekInput, zoekers: Set<string>) {
    this.zoekerComponent.toonResultaat = true;
    this.zoekerComponent.increaseBusy();
    this.dispatch({
      type: "Zoek",
      input: zoekInput,
      zoekers: zoekers,
      wrapper: kaartLogOnlyWrapper
    });
  }

  // Gebruik de waarde van de VORIGE control om een request te doen,
  //   maar alleen als die vorige waarde een object was (dus door de gebruiker aangeklikt in de lijst).
  // Filter het antwoord daarvan met de (eventuele) waarde van onze HUIDIGE control, dit om autocomplete te doen.
  protected autocomplete<T, A>(
    vorige: FormControl,
    provider: (A) => Observable<T[]>,
    huidige: FormControl,
    propertyGetter: (T) => string
  ): Observable<T[]> {
    // Filter een array van waardes met de waarde van een filter (control), de filter kan een string of een object zijn.
    function filterMetWaarde(): UnaryFunction<Observable<T[]>, Observable<T[]>> {
      return combineLatest(huidige.valueChanges.pipe(startWith<string | T>(""), distinctUntilChanged()), (waardes, filterWaarde) => {
        if (!filterWaarde) {
          return waardes;
        } else if (typeof filterWaarde === "string") {
          return waardes.filter(value =>
            propertyGetter(value)
              .toLocaleLowerCase()
              .includes(filterWaarde.toLocaleLowerCase())
          );
        } else {
          return waardes.filter(value =>
            propertyGetter(value)
              .toLocaleLowerCase()
              .includes(propertyGetter(filterWaarde).toLocaleLowerCase())
          );
        }
      });
    }

    return vorige.valueChanges.pipe(distinctUntilChanged(), this.safeProvider(provider), filterMetWaarde(), shareReplay(1));
  }

  // inputWaarde kan een string of een object zijn. Enkel wanneer het een object is, roepen we de provider op,
  // anders geven we een lege array terug.
  private safeProvider<A, T>(provider: (A) => Observable<T[]>): UnaryFunction<Observable<A>, Observable<T[]>> {
    return switchMap(inputWaarde => {
      return isNotNullObject(inputWaarde)
        ? this.busy(provider(inputWaarde)).pipe(
            catchError((error, obs) => {
              this.meldFout(error);
              return Observable.of([]);
            })
          )
        : Observable.of([]);
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
  @ViewChild("zoekVeldElement") zoekVeldElement: ElementRef;

  zoekerPerceelGetraptComponent: GetraptZoekerComponent;
  @ViewChild("zoekerPerceelGetrapt")
  set setZoekerPerceelGetraptComponent(zoekerPerceelGetrapt: GetraptZoekerComponent) {
    this.zoekerPerceelGetraptComponent = zoekerPerceelGetrapt;
  }

  zoekerCrabGetraptComponent: GetraptZoekerComponent;
  @ViewChild("zoekerCrabGetrapt")
  set setZoekerCrabGetraptComponent(zoekerCrabGetrapt: GetraptZoekerComponent) {
    this.zoekerCrabGetraptComponent = zoekerCrabGetrapt;
  }

  featuresByResultaat = Map<ZoekResultaat, ol.Feature[]>();
  huidigeSelectie: Option<HuidigeSelectie> = none;
  alleZoekResultaten: ZoekResultaat[] = [];
  alleFouten: Fout[] = [];
  legende: Map<string, IconDescription> = Map<string, IconDescription>();
  legendeKeys: string[] = [];
  toonHelp = false;
  toonResultaat = true;
  busy = 0;
  actieveZoeker: ZoekerType = "Basis";
  perceelMaakLeegDisabled: Boolean;
  crabMaakLeegDisabled: Boolean;

  private extent: ol.Extent = ol.extent.createEmpty();

  private static createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: ZoekerUiSelector,
      source: new ol.source.Vector(),
      styleSelector: none,
      selectieStyleSelector: none,
      hoverStyleSelector: none,
      selecteerbaar: false,
      hover: false,
      minZoom: 2,
      maxZoom: 15,
      offsetveld: none,
      velden: OrderedMap<string, VeldInfo>()
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
      feature.setId(resultaat.bron + "_" + resultaat.index);
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

  constructor(parent: KaartComponent, zone: NgZone, private cd: ChangeDetectorRef) {
    super(parent, zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ZoekerSubscription(r => this.processZoekerAntwoord(r))];
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

  zoomNaarResultaat(resultaat: ZoekResultaat) {
    this.toonResultaat = false;
    this.toonHelp = false;
    this.dispatch(prt.ZoekGekliktCmd(resultaat));
    resultaat.kaartInfo.filter(info => !ol.extent.isEmpty(info.extent)).map(info => {
      this.dispatch(prt.VeranderExtentCmd(info.geometry.getExtent()));
      if (info.geometry.getType() === "Point") {
        resultaat.preferredPointZoomLevel.map(zoom => this.dispatch(prt.VeranderZoomCmd(zoom, kaartLogOnlyWrapper)));
      }
      const selectedFeature = this.featuresByResultaat.get(resultaat)[0];
      this.highlight(selectedFeature, info);
    });
  }

  private highlight(nieuweFeature: ol.Feature, zoekKaartResultaat: ZoekKaartResultaat) {
    forEach(this.huidigeSelectie, selectie => selectie.feature.setStyle(selectie.zoekResultaat.style));
    nieuweFeature.setStyle(zoekKaartResultaat.highlightStyle);
    this.huidigeSelectie = some({
      feature: nieuweFeature,
      zoekResultaat: zoekKaartResultaat
    });
  }

  zoek() {
    if (this.zoekVeld.value) {
      this.toonResultaat = true;
      this.increaseBusy();
      this.dispatch({
        type: "Zoek",
        input: { type: "string", value: this.zoekVeld.value } as StringZoekInput,
        zoekers: Set(),
        wrapper: kaartLogOnlyWrapper
      });
    }
  }

  kuisZoekOp() {
    this.clearBusy();
    this.maakResultaatLeeg();
    this.focusOpZoekVeld();
  }

  focusOpZoekVeld() {
    setTimeout(() => {
      if (this.actieveZoeker === "Basis") {
        this.zoekVeldElement.nativeElement.focus();
      }
    });
  }

  onKey(event: any) {
    // De gebruiker kan locatie voorstellen krijgen door in het zoekveld max. 2 tekens in te typen en op enter te drukken
    if (event.keyCode === 13 && event.srcElement.value.length >= 2) {
      this.zoek();
    }
  }

  heeftFout(): boolean {
    return this.alleFouten.length > 0;
  }

  isInklapbaar(): boolean {
    return this.heeftFout() || this.alleZoekResultaten.length > 0 || this.actieveZoeker === "Perceel" || this.actieveZoeker === "Crab";
  }

  kiesZoeker(zoeker: ZoekerType) {
    this.clearBusy();
    this.maakResultaatLeeg();
    this.actieveZoeker = zoeker;
    this.focusOpZoekVeld();
    this.toonResultaat = true;
  }

  maakResultaatLeeg() {
    this.zoekVeld.setValue("");
    this.zoekVeld.markAsPristine();
    this.alleFouten = [];
    this.alleZoekResultaten = [];
    this.featuresByResultaat = Map<ZoekResultaat, ol.Feature[]>();
    this.huidigeSelectie = none;
    this.extent = ol.extent.createEmpty();
    this.legende.clear();
    this.legendeKeys = [];
    this.dispatch(prt.VervangFeaturesCmd(ZoekerUiSelector, List(), kaartLogOnlyWrapper));
  }

  private processZoekerAntwoord(nieuweResultaten: ZoekResultaten): KaartInternalMsg {
    kaartLogger.debug("Process " + nieuweResultaten.zoeker);
    this.alleZoekResultaten = this.alleZoekResultaten
      .filter(resultaat => resultaat.zoeker !== nieuweResultaten.zoeker)
      .concat(nieuweResultaten.resultaten);
    this.alleZoekResultaten.sort((a, b) => compareResultaten(a, b, this.zoekVeld.value));
    nieuweResultaten.legende.forEach((safeHtml, name) => this.legende.set(name!, safeHtml!));
    this.legendeKeys = this.legende.keySeq().toArray();

    this.alleFouten = this.alleFouten
      .filter(resultaat => resultaat.zoeker !== nieuweResultaten.zoeker)
      .concat(nieuweResultaten.fouten.map(fout => new Fout(nieuweResultaten.zoeker, fout)));

    this.featuresByResultaat = this.alleZoekResultaten.reduce(
      (map, resultaat) => map.set(resultaat, ZoekerBoxComponent.maakNieuwFeature(resultaat)),
      Map<ZoekResultaat, ol.Feature[]>()
    );

    this.extent = this.alleZoekResultaten
      .map(resultaat => resultaat.kaartInfo)
      .reduce((maxExtent, kaartInfo) => kaartInfo.fold(maxExtent, i => ol.extent.extend(maxExtent!, i.extent)), ol.extent.createEmpty());

    this.decreaseBusy();
    this.dispatch(
      prt.VervangFeaturesCmd(
        ZoekerUiSelector,
        this.featuresByResultaat.toList().reduce((list, fs) => list!.push(...fs!), List<ol.Feature>()),
        kaartLogOnlyWrapper
      )
    );
    return {
      type: "KaartInternal",
      payload: none
    };
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

  onCrabMaakLeegDisabledChange(maakLeegDisabled: Boolean): void {
    setTimeout(() => {
      this.crabMaakLeegDisabled = maakLeegDisabled;
    });
  }

  onPerceelMaakLeegDisabledChange(maakLeegDisabled: Boolean): void {
    setTimeout(() => {
      this.perceelMaakLeegDisabled = maakLeegDisabled;
    });
  }
}
