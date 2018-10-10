import { AfterViewInit, Component, NgZone, OnInit, QueryList, ViewChildren } from "@angular/core";
import { MatButton } from "@angular/material";
import { none, Option, some } from "fp-ts/lib/Option";
import { List, OrderedMap } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map, mapTo, switchMap } from "rxjs/operators";

import { flatten } from "../../util/operators";
import { orElse } from "../../util/option";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { VeldInfo } from "../kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { Viewinstellingen } from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";
import * as ss from "../stijl-selector";

export const MijnLocatieUiSelector = "Mijnlocatie";
const MijnLocatieLaagNaam = "Mijn Locatie";

@Component({
  selector: "awv-kaart-mijn-locatie",
  templateUrl: "./kaart-mijn-locatie.component.html",
  styleUrls: ["./kaart-mijn-locatie.component.scss"]
})
export class KaartMijnLocatieComponent extends KaartChildComponentBase implements OnInit, AfterViewInit {
  private viewinstellingen$: rx.Observable<Viewinstellingen> = rx.empty();
  private zoomdoelSetting$: rx.Observable<Option<number>> = rx.empty();

  enabled$: rx.Observable<boolean> = rx.of(true);

  @ViewChildren("locateBtn") locateBtnQry: QueryList<MatButton>;

  mijnLocatieStyle: ol.style.Style;
  mijnLocatie: Option<ol.Feature> = none;

  static pasFeatureAan(feature: ol.Feature, coordinate: ol.Coordinate): Option<ol.Feature> {
    feature.setGeometry(new ol.geom.Point(coordinate));
    return some(feature);
  }

  constructor(zone: NgZone, private readonly parent: KaartComponent) {
    super(parent, zone);
    this.mijnLocatieStyle = new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        scale: 0.5,
        color: "#00a2c5",
        src: require("material-design-icons/maps/2x_web/ic_my_location_white_18dp.png")
      })
    });
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
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();
    const zoomdoel$: rx.Observable<number> = this.zoomdoelSetting$.pipe(flatten); // Hou enkel de effectieve zoomniveaudoelen over

    this.bindToLifeCycle(
      // Omdat de button in een ngIf zit, moeten we op zoek naar de button in ngAfterViewInit
      this.locateBtnQry.changes.pipe(
        switchMap(ql =>
          rx.combineLatest(this.viewinstellingen$, zoomdoel$, (zi, doel) => [zi.zoom, doel]).pipe(
            // Blijf op de hoogte van huidige en gewenste zoom
            switchMap(params => rx.fromEvent(ql.first._getHostElement(), "click").pipe(mapTo(params))) // van click naar zoom
          )
        )
      )
    ).subscribe(([zoom, doelniveau]) => this.zoomNaarMijnLocatie(zoom, doelniveau));
  }

  private maakNieuwFeature(coordinate: ol.Coordinate): Option<ol.Feature> {
    const feature = new ol.Feature(new ol.geom.Point(coordinate));
    feature.setStyle(this.mijnLocatieStyle);
    this.dispatch(prt.VervangFeaturesCmd(MijnLocatieLaagNaam, List.of(feature), kaartLogOnlyWrapper));
    return some(feature);
  }

  private meldFout(fout: PositionError | string) {
    kaartLogger.error("error", fout);
    this.dispatch(
      prt.MeldComponentFoutCmd(
        List.of("Zoomen naar huidige locatie niet mogelijk", "De toepassing heeft geen toestemming om locatie te gebruiken")
      )
    );
  }

  private zoomNaarMijnLocatie(zoom: number, doelzoom: number) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(positie => this.zetMijnPositie(positie, zoom, doelzoom), fout => this.meldFout(fout), {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 50000
      });
    } else {
      this.meldFout("Geen geolocatie mogelijk");
    }
  }

  private zetMijnPositie(position: Position, zoom: number, doelzoom: number) {
    if (zoom <= 2) {
      // We zitten nu op heel Vlaanderen, dus gaan we eerst inzoomen.
      this.dispatch(prt.VeranderZoomCmd(doelzoom, kaartLogOnlyWrapper));
    }

    const longLat: ol.Coordinate = [position.coords.longitude, position.coords.latitude];

    const coordinate = ol.proj.fromLonLat(longLat, "EPSG:31370");
    this.dispatch(prt.VeranderMiddelpuntCmd(coordinate));

    this.mijnLocatie = orElse(this.mijnLocatie.chain(feature => KaartMijnLocatieComponent.pasFeatureAan(feature, coordinate)), () =>
      this.maakNieuwFeature(coordinate)
    );
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: MijnLocatieLaagNaam,
      source: new ol.source.Vector(),
      styleSelector: some(ss.StaticStyle(this.mijnLocatieStyle)),
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
