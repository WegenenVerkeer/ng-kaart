import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { none } from "fp-ts/lib/Option";
import { List, OrderedMap, Set } from "immutable";
import * as ol from "openlayers";
import { UnaryFunction } from "rxjs/interfaces";
import { Observable } from "rxjs/Observable";
import {
  catchError,
  combineLatest,
  debounce,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap
} from "rxjs/operators";
import { pipe } from "rxjs/Rx";

import { KaartChildComponentBase } from "../../kaart/kaart-child-component-base";
import * as ke from "../../kaart/kaart-elementen";
import { VeldInfo } from "../../kaart/kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { KaartComponent } from "../../kaart/kaart.component";
import { kaartLogger } from "../../kaart/log";
import { matchGeometryType } from "../../util/geometryTypes";

import { compareResultaten, IconDescription, StringZoekInput, ZoekInput, ZoekResultaat, ZoekResultaten } from "../zoeker-base";

export const ZoekerUiSelector = "Zoeker";

export class Fout {
  constructor(readonly zoeker: string, readonly fout: string) {}
}

export type ZoekerType = "Geoloket" | "Perceel" | "Crab";

export function isNotNullObject(object) {
  return object && object instanceof Object;
}

export function toNonEmptyDistinctLowercaseString(): UnaryFunction<Observable<any>, Observable<string>> {
  return pipe(
    filter(value => value), // filter de lege waardes eruit
    // zorg dat we een lowercase waarde hebben zonder leading of trailing spaties.
    map(value =>
      value
        .toString()
        .trim()
        .toLocaleLowerCase()
    ),
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
  templateUrl: "./zoeker-box.html",
  styleUrls: ["./zoeker-box.scss"]
})
export class ZoekerBoxComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  zoekVeld = new FormControl();
  alleZoekResultaten: ZoekResultaat[] = [];
  alleFouten: Fout[] = [];
  legende: Map<string, IconDescription> = new Map<string, IconDescription>();
  legendeKeys: string[] = [];
  toonHelp = false;
  toonResultaat = true;
  busy = 0;
  actieveZoeker: ZoekerType = "Geoloket";

  private byPassDebounce: () => void;
  private extent: ol.Extent = ol.extent.createEmpty();

  private static createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: ZoekerUiSelector,
      source: new ol.source.Vector(),
      styleSelector: none,
      selectieStyleSelector: none,
      selecteerbaar: false,
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
    this.bindToLifeCycle(
      this.zoekVeld.valueChanges.pipe(
        filter(value => value !== null),
        map(value => value.trim()),
        debounce((value: string) => {
          // Form changes worden debounced tot deze promise geresolved wordt.
          return new Promise(resolve => {
            // We houden de resolve functie pointer bij om de debounce te kunnen bypassen (bv. bij form submit).
            this.byPassDebounce = resolve;
            if (value.length >= 3 || value.length === 0) {
              // De gebruiker kan locatie voorstellen krijgen door in het zoekveld minstens 3 tekens in te typen.
              // We resolven hoe dan ook na een bepaalde timeout, zodat de zoek uitgevoerd wordt.
              setTimeout(resolve, 800);
            }
          });
        }),
        distinctUntilChanged()
      )
    ).subscribe(value => {
      this.toonResultaat = true;
      if (value.length > 0) {
        this.increaseBusy();
        this.dispatch({
          type: "Zoek",
          input: { type: "string", value: value } as StringZoekInput,
          zoekers: Set(),
          wrapper: kaartLogOnlyWrapper
        });
      }
    });
    this.dispatch({
      type: "VoegLaagToe",
      positie: 1,
      laag: ZoekerBoxComponent.createLayer(),
      magGetoondWorden: true,
      laaggroep: "Tools",
      legende: none,
      wrapper: kaartLogOnlyWrapper
    });
  }

  ngOnDestroy(): void {
    this.dispatch(prt.VerwijderLaagCmd(ZoekerUiSelector, kaartLogOnlyWrapper));
    super.ngOnDestroy();
  }

  toggleResultaat() {
    this.toonResultaat = !this.toonResultaat;
    if (this.toonResultaat) {
      this.zoomNaarVolledigeExtent();
    }
  }

  toggleHelp() {
    this.toonHelp = !this.toonHelp;
  }

  zoomNaarResultaat(resultaat: ZoekResultaat) {
    this.toonResultaat = false;
    this.toonHelp = false;
    this.dispatch(prt.ZoekGekliktCmd(resultaat));
    resultaat.kaartInfo.filter(info => !ol.extent.isEmpty(info.extent)).map(info => this.dispatch(prt.VeranderExtentCmd(info.extent)));
  }

  onKey(event: any) {
    // De gebruiker kan locatie voorstellen krijgen door in het zoekveld max. 2 tekens in te typen en op enter te drukken
    if (event.keyCode === 13 && event.srcElement.value.length >= 2 && this.byPassDebounce) {
      this.byPassDebounce();
    }
  }

  heeftFout(): boolean {
    return this.alleFouten.length > 0;
  }

  heeftResultaatOfFout(): boolean {
    return this.heeftFout() || this.alleZoekResultaten.length > 0;
  }

  kiesZoeker(zoeker: ZoekerType) {
    this.maakResultaatLeeg();
    this.busy = 0; // Voor alle zekerheid.
    this.actieveZoeker = zoeker;
  }

  getPlaceholder(): string {
    switch (this.actieveZoeker) {
      case "Geoloket":
        return "Zoek";
      case "Perceel":
        return "Zoek op Perceel";
      case "Crab":
        return "Zoek op CRAB";
    }
  }

  maakResultaatLeeg() {
    this.zoekVeld.setValue("");
    this.alleFouten = [];
    this.alleZoekResultaten = [];
    this.extent = ol.extent.createEmpty();
    this.legende.clear();
    this.legendeKeys = [];
    this.dispatch(prt.VervangFeaturesCmd(ZoekerUiSelector, List(), kaartLogOnlyWrapper));
  }

  private processZoekerAntwoord(nieuweResultaten: ZoekResultaten): KaartInternalMsg {
    this.decreaseBusy();
    this.alleZoekResultaten = this.alleZoekResultaten
      .filter(resultaat => resultaat.zoeker !== nieuweResultaten.zoeker)
      .concat(nieuweResultaten.resultaten);
    this.alleZoekResultaten.sort((a, b) => compareResultaten(a, b, this.zoekVeld.value));
    nieuweResultaten.legende.forEach((safeHtml, name) => this.legende.set(name!, safeHtml!));
    this.legendeKeys = Array.from(this.legende.keys());

    this.alleFouten = this.alleFouten
      .filter(resultaat => resultaat.zoeker !== nieuweResultaten.zoeker)
      .concat(nieuweResultaten.fouten.map(fout => new Fout(nieuweResultaten.zoeker, fout)));

    const features: List<ol.Feature> = this.alleZoekResultaten.reduce(
      (list, resultaat) => list.push(...ZoekerBoxComponent.maakNieuwFeature(resultaat)),
      List<ol.Feature>()
    );
    this.extent = this.alleZoekResultaten
      .map(resultaat => resultaat.kaartInfo)
      .reduce((maxExtent, kaartInfo) => kaartInfo.fold(maxExtent, i => ol.extent.extend(maxExtent!, i.extent)), ol.extent.createEmpty());

    this.dispatch(prt.VervangFeaturesCmd(ZoekerUiSelector, features, kaartLogOnlyWrapper));

    this.zoomNaarVolledigeExtent();

    return {
      type: "KaartInternal",
      payload: none
    };
  }

  private zoomNaarVolledigeExtent() {
    if (!ol.extent.isEmpty(this.extent)) {
      this.dispatch(prt.VeranderExtentCmd(this.extent));
    }
  }

  increaseBusy() {
    this.busy++;
    this.cd.detectChanges();
  }

  decreaseBusy() {
    if (this.busy > 0) {
      this.busy--;
      this.cd.detectChanges();
    }
  }

  isBusy(): boolean {
    return this.busy > 0;
  }
}
