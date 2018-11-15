import { AfterViewInit, Component, NgZone, OnInit, QueryList, ViewChildren } from "@angular/core";
import { MatButton } from "@angular/material";
import { Function2 } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import { List, OrderedMap } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Subject } from "rxjs";
import { distinctUntilChanged, map, switchMap, take } from "rxjs/operators";

import { flatten } from "../../util/operators";
import { VeldInfo } from "../kaart-elementen";
import * as ke from "../kaart-elementen";
import { actieveModusGezetWrapper, KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { Viewinstellingen } from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";

export const MijnLocatieUiSelector = "Mijnlocatie";
const MijnLocatieLaagNaam = "Mijn Locatie";

interface Zoom {
  zoom: number;
  doel: number;
}

interface Locatie extends Zoom {
  positie: Position;
}

interface Activatie extends Zoom {
  actief: boolean;
}

const Zoom: Function2<number, number, Zoom> = (zoom, doel) => ({ zoom: zoom, doel: doel });
const Locatie: Function2<Zoom, Position, Locatie> = (zoom, positie) => ({ ...zoom, positie: positie });
const Activatie: Function2<Zoom, boolean, Activatie> = (zoom, actief) => ({ ...zoom, actief: actief });

const pasFeatureAan = (feature: ol.Feature, coordinate: ol.Coordinate, zoom: number, accuracy: number): Option<ol.Feature> => {
  feature.setGeometry(new ol.geom.Point(coordinate));
  zetStijl(feature, zoom, accuracy);
  return some(feature);
};

const zetStijl = (feature: ol.Feature, zoom: number, accuracy: number): void => feature.setStyle(mijnLocatieStijl(zoom, accuracy));

const mijnLocatieStijl = (zoom: number, accuracy: number): ol.style.Style => {
  // TODO: resolutions moet uit kaart komen
  const resolutions = [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125];
  const accuracyInPixels = accuracy / resolutions[zoom - 1];
  const radius = Math.max(accuracyInPixels, 4);
  return new ol.style.Style({
    image: new ol.style.Circle({
      fill: new ol.style.Fill({
        color: [65, 105, 225, 0.1]
      }),
      stroke: new ol.style.Stroke({
        color: [65, 105, 225, 1],
        width: 1.25
      }),
      radius: radius
    })
  });
};

@Component({
  selector: "awv-kaart-mijn-locatie",
  templateUrl: "./kaart-mijn-locatie.component.html",
  styleUrls: ["./kaart-mijn-locatie.component.scss"]
})
export class KaartMijnLocatieComponent extends KaartModusComponent implements OnInit, AfterViewInit {
  private viewinstellingen$: rx.Observable<Viewinstellingen> = rx.empty();
  private zoomdoelSetting$: rx.Observable<Option<number>> = rx.empty();
  private activeerSubj: Subject<boolean> = new Subject<boolean>();
  private locatieSubj: Subject<Position> = new Subject<Position>();

  enabled$: rx.Observable<boolean> = rx.of(true);

  @ViewChildren("locateBtn")
  locateBtnQry: QueryList<MatButton>;

  private mijnLocatie: Option<ol.Feature> = none;
  private watchId: Option<number> = none;

  modus(): string {
    return MijnLocatieUiSelector;
  }

  isDefaultModus() {
    return false;
  }

  // geactiveerd van buiten af
  activeer(active: boolean) {
    this.actief = active;
    this.activeerSubj.next(this.actief);
  }

  public get isActief(): boolean {
    return this.actief;
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper)];
  }

  // activatie geinitieerd door gebruiker
  toggleLocatieTracking(): void {
    this.actief = !this.actief;
    this.activeerSubj.next(this.actief);
    if (this.actief) {
      this.publiceerActivatie();
    } else {
      this.publiceerDeactivatie();
    }
  }

  constructor(zone: NgZone, private readonly parent: KaartComponent) {
    super(parent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.dispatch({
      type: "VoegLaagToe",
      positie: 0,
      laag: this.createLayer(),
      magGetoondWorden: true,
      laaggroep: "Tools",
      legende: none,
      stijlInLagenKiezer: none,
      wrapper: kaartLogOnlyWrapper
    });

    this.viewinstellingen$ = this.parent.modelChanges.viewinstellingen$;
    this.zoomdoelSetting$ = this.parent.modelChanges.mijnLocatieZoomDoel$;
    this.enabled$ = this.zoomdoelSetting$.pipe(map(m => m.isSome()));

    const zoomdoel$: rx.Observable<number> = this.zoomdoelSetting$.pipe(flatten); // Hou enkel de effectieve zoomniveaudoelen over
    const zoom$ = this.viewinstellingen$.pipe(
      distinctUntilChanged((vi1, vi2) => vi1.zoom === vi2.zoom && vi1.minZoom === vi2.minZoom && vi1.maxZoom === vi2.maxZoom),
      map(vi => vi.zoom)
    );

    this.bindToLifeCycle(
      this.activeerSubj.pipe(
        switchMap(actief =>
          rx.combineLatest([zoom$, zoomdoel$]).pipe(
            take(1),
            map(([zoom, doel]) => Activatie(Zoom(zoom, doel), actief))
          )
        )
      )
    ).subscribe(zoomActief => (zoomActief.actief ? this.startTracking(zoomActief.zoom, zoomActief.doel) : this.stopTracking()));

    this.bindToLifeCycle(
      rx.combineLatest(zoom$, zoomdoel$, this.locatieSubj).pipe(map(([zoom, doel, locatie]) => Locatie(Zoom(zoom, doel), locatie)))
    ).subscribe(zoomPositie => this.zetMijnPositie(zoomPositie.positie, zoomPositie.zoom, zoomPositie.doel));
  }

  private maakNieuwFeature(coordinate: ol.Coordinate, zoom: number, accuracy: number): Option<ol.Feature> {
    const feature = new ol.Feature(new ol.geom.Point(coordinate));
    feature.setStyle(mijnLocatieStijl(zoom, accuracy));
    this.dispatch(prt.VervangFeaturesCmd(MijnLocatieLaagNaam, List.of(feature), kaartLogOnlyWrapper));
    return some(feature);
  }

  private verwijderFeature() {
    this.mijnLocatie = none;
    this.dispatch(prt.VervangFeaturesCmd(MijnLocatieLaagNaam, List(), kaartLogOnlyWrapper));
  }

  private meldFout(fout: PositionError | string) {
    kaartLogger.error("error", fout);
    this.dispatch(
      prt.MeldComponentFoutCmd(
        List.of("Zoomen naar huidige locatie niet mogelijk", "De toepassing heeft geen toestemming om locatie te gebruiken")
      )
    );
  }

  private stopTracking() {
    this.watchId.map(watchId => navigator.geolocation.clearWatch(watchId));
    this.verwijderFeature();
  }

  private startTracking(zoom: number, doelzoom: number) {
    if (navigator.geolocation) {
      this.watchId = some(
        navigator.geolocation.watchPosition(
          //
          positie => this.locatieSubj.next(positie),
          fout => this.meldFout(fout),
          {
            enableHighAccuracy: true,
            timeout: 1000,
            maximumAge: 0
          }
        )
      );
    } else {
      this.meldFout("Geen geolocatie mogelijk");
    }
  }

  private zetMijnPositie(position: Position, zoom: number, doelzoom: number) {
    const longLat: ol.Coordinate = [position.coords.longitude, position.coords.latitude];

    const coordinate = ol.proj.fromLonLat(longLat, "EPSG:31370");
    this.dispatch(prt.VeranderMiddelpuntCmd(coordinate));

    this.mijnLocatie = this.mijnLocatie.chain(feature => pasFeatureAan(feature, coordinate, zoom, position.coords.accuracy)).orElse(() => {
      if (zoom <= 8) {
        // We zitten nu op een te laag zoomniveau, dus gaan we eerst inzoomen.
        this.dispatch(prt.VeranderZoomCmd(doelzoom, kaartLogOnlyWrapper));
      }
      return this.maakNieuwFeature(coordinate, zoom, position.coords.accuracy);
    });
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: MijnLocatieLaagNaam,
      source: new ol.source.Vector(),
      styleSelector: none,
      styleSelectorBron: none,
      selectieStyleSelector: none,
      hoverStyleSelector: none,
      selecteerbaar: false,
      hover: false,
      minZoom: 2,
      maxZoom: 15,
      velden: OrderedMap<string, VeldInfo>(),
      offsetveld: none,
      verwijderd: false
    };
  }
}
