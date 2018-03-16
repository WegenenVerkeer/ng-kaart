import { Component, Input, NgZone, OnDestroy, OnChanges, OnInit } from "@angular/core";
import { SimpleChanges } from "@angular/core/src/metadata/lifecycle_hooks";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { KaartWithInfo } from "./kaart-with-info";
import { KaartEventDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { FoutGebeurd, VeranderMiddelpunt, VeranderZoomniveau, VervangFeatures, VerwijderLaag, VoegLaagToe } from "./kaart-protocol-events";
import { observeOnAngular } from "../util/observe-on-angular";
import * as ol from "openlayers";

import { kaartLogger } from "./log";
import { some } from "fp-ts/lib/Option";
import * as ke from "./kaart-elementen";
import { List } from "immutable";

export interface KaartLocatieProps {
  zoom: number;
}

const MijnLocatieLaagNaam = "Mijn Locatie";

@Component({
  selector: "awv-kaart-mijn-locatie",
  templateUrl: "./kaart-mijn-locatie.component.html",
  styleUrls: ["./kaart-mijn-locatie.component.scss"]
})
export class KaartMijnLocatieComponent extends KaartComponentBase implements OnChanges, OnDestroy, OnInit {
  kaartProps$: Observable<KaartLocatieProps> = Observable.empty();

  mijnLocatieStyle: ol.style.Style;
  mijnLocatie: ol.Feature[] = [];

  @Input() kaartModel$: Observable<KaartWithInfo> = Observable.never();
  @Input() dispatcher: KaartEventDispatcher = VacuousDispatcher;

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
    this.dispatcher.dispatch(new VoegLaagToe(Number.MAX_SAFE_INTEGER, this.createLayer(), true));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.kaartProps$ = this.kaartModel$.pipe(
      map(m => ({
        zoom: m.zoom
      })),
      observeOnAngular(this.zone)
    );
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.dispatcher.dispatch(new VerwijderLaag(MijnLocatieLaagNaam));
  }

  zetMijnPositie(zoom: boolean, position: Position) {
    if (zoom) {
      // We zitten nu op heel Vlaanderen, dus gaan we eerst inzoomen.
      this.dispatcher.dispatch(new VeranderZoomniveau(11));
    }

    const longLat: ol.Coordinate = [position.coords.longitude, position.coords.latitude];
    const coordinate = ol.proj.fromLonLat(longLat, "EPSG:31370");
    this.dispatcher.dispatch(new VeranderMiddelpunt(coordinate));

    if (this.mijnLocatie.length === 0) {
      const feature = new ol.Feature(new ol.geom.Point(coordinate));
      feature.setStyle(this.mijnLocatieStyle);
      this.mijnLocatie.push(feature);
      this.dispatcher.dispatch(new VervangFeatures(MijnLocatieLaagNaam, List(this.mijnLocatie)));
    } else {
      this.mijnLocatie[0].setGeometry(new ol.geom.Point(coordinate));
    }
  }

  meldFout(fout: PositionError) {
    kaartLogger.error("error", fout);
    this.dispatcher.dispatch(
      new FoutGebeurd("Zoomen naar huidige locatie niet mogelijk\nDe toepassing heeft geen toestemming om locatie te gebruiken")
    );
  }

  zoomNaarMijnLocatie(props: KaartLocatieProps) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(positie => this.zetMijnPositie(props.zoom <= 2, positie), fout => this.meldFout(fout), {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 50000
      });
    } else {
      kaartLogger.error("error", "Geen geolocatie mogelijk");
      this.dispatcher.dispatch(
        new FoutGebeurd("Zoomen naar huidige locatie niet mogelijk\nDe toepassing heeft geen toestemming om locatie te gebruiken")
      );
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
