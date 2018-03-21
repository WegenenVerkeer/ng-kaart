import { Component, Input, NgZone, OnDestroy, OnChanges, OnInit } from "@angular/core";
import { SimpleChanges } from "@angular/core/src/metadata/lifecycle_hooks";
import { Observable } from "rxjs/Observable";
import { map, filter } from "rxjs/operators";

import { KaartWithInfo } from "./kaart-with-info";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { observeOnAngular } from "../util/observe-on-angular";
import * as ol from "openlayers";

import { kaartLogger } from "./log";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ke from "./kaart-elementen";
import { List } from "immutable";
import { orElse } from "../util/option";
import {
  KaartInternalMsg,
  forgetWrapper,
  KaartInternalSubMsg,
  zoominstellingenGezetWrapper,
  ZoominstellingenGezetMsg,
  successWrapper
} from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

const MijnLocatieLaagNaam = "Mijn Locatie";

@Component({
  selector: "awv-kaart-mijn-locatie",
  templateUrl: "./kaart-mijn-locatie.component.html",
  styleUrls: ["./kaart-mijn-locatie.component.scss"]
})
export class KaartMijnLocatieComponent extends KaartComponentBase implements OnChanges, OnDestroy, OnInit {
  zoom$: Observable<number> = Observable.empty();

  mijnLocatieStyle: ol.style.Style;
  mijnLocatie: Option<ol.Feature> = none;

  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();
  @Input() zoomniveau: number;

  static pasFeatureAan(feature: ol.Feature, coordinate: ol.Coordinate): Option<ol.Feature> {
    feature.setGeometry(new ol.geom.Point(coordinate));
    return some(feature);
  }

  constructor(zone: NgZone) {
    super(zone);
    this.mijnLocatieStyle = new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        scale: 0.5,
        color: "#00a2c5",
        src: "./material-design-icons/maps/2x_web/ic_my_location_white_18dp.png"
      })
    });
  }

  ngOnInit(): void {
    this.dispatcher.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: this.createLayer(),
      magGetoondWorden: true,
      wrapper: forgetWrapper
    });
    this.dispatcher.dispatch({
      type: "Subscription",
      subscription: prt.ZoominstellingenSubscription(zoominstellingenGezetWrapper),
      wrapper: forgetWrapper
    });
    this.zoom$ = this.internalMessage$.pipe(
      filter(m => m.type === "ZoominstellingenGezet"), //
      map(m => (m as ZoominstellingenGezetMsg).zoominstellingen.zoom),
      observeOnAngular(this.zone)
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    // this.kaartProps$ = this.kaartModel$.pipe(
    //   map(m => ({
    //     zoom: m.zoom
    //   })),
    //   observeOnAngular(this.zone)
    // );
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.dispatcher.dispatch({ type: "VerwijderLaag", titel: MijnLocatieLaagNaam, wrapper: forgetWrapper });
  }

  zetMijnPositie(zoom: boolean, position: Position) {
    if (zoom) {
      // We zitten nu op heel Vlaanderen, dus gaan we eerst inzoomen.
      this.dispatcher.dispatch({ type: "VeranderZoom", zoom: this.zoomniveau, wrapper: forgetWrapper });
    }

    const longLat: ol.Coordinate = [position.coords.longitude, position.coords.latitude];

    const coordinate = ol.proj.fromLonLat(longLat, "EPSG:31370");
    this.dispatcher.dispatch({ type: "VeranderMiddelpunt", coordinate: coordinate, wrapper: forgetWrapper });

    this.mijnLocatie = orElse(this.mijnLocatie.chain(feature => KaartMijnLocatieComponent.pasFeatureAan(feature, coordinate)), () =>
      this.maakNieuwFeature(coordinate)
    );
  }

  maakNieuwFeature(coordinate: ol.Coordinate): Option<ol.Feature> {
    const feature = new ol.Feature(new ol.geom.Point(coordinate));
    feature.setStyle(this.mijnLocatieStyle);
    this.dispatcher.dispatch({ type: "VervangFeatures", titel: MijnLocatieLaagNaam, features: List.of(feature), wrapper: forgetWrapper });
    return some(feature);
  }

  meldFout(fout: PositionError | string) {
    kaartLogger.error("error", fout);
    this.dispatcher.dispatch({
      type: "MeldComponentFout",
      fouten: List.of("Zoomen naar huidige locatie niet mogelijk", "De toepassing heeft geen toestemming om locatie te gebruiken"),
      wrapper: forgetWrapper
    });
  }

  zoomNaarMijnLocatie(zoom: number) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(positie => this.zetMijnPositie(zoom <= 2, positie), fout => this.meldFout(fout), {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 50000
      });
    } else {
      this.meldFout("Geen geolocatie mogelijk");
    }
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: MijnLocatieLaagNaam,
      source: new ol.source.Vector(),
      styleSelector: some(ke.StaticStyle(this.mijnLocatieStyle)),
      selecteerbaar: false,
      minZoom: 2,
      maxZoom: 15
    };
  }
}
