import { Component, Input, NgZone, OnInit } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { observeOnAngular } from "../util/observe-on-angular";
import { ofType } from "../util/operators";
import { orElse } from "../util/option";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import * as ke from "./kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper, ZoominstellingenGezetMsg, zoominstellingenGezetWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { kaartLogger } from "./log";

const MijnLocatieLaagNaam = "Mijn Locatie";

@Component({
  selector: "awv-kaart-mijn-locatie",
  templateUrl: "./kaart-mijn-locatie.component.html",
  styleUrls: ["./kaart-mijn-locatie.component.scss"]
})
export class KaartMijnLocatieComponent extends KaartChildComponentBase implements OnInit {
  zoom$: Observable<number> = Observable.empty();

  mijnLocatieStyle: ol.style.Style;
  mijnLocatie: Option<ol.Feature> = none;

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

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ZoominstellingenSubscription(zoominstellingenGezetWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.dispatcher.dispatch({
      type: "VoegLaagToe",
      positie: 0,
      laag: this.createLayer(),
      magGetoondWorden: true,
      laaggroep: "Tools",
      wrapper: kaartLogOnlyWrapper
    });

    this.zoom$ = this.internalMessage$.pipe(
      ofType<ZoominstellingenGezetMsg>("ZoominstellingenGezet"), //
      map(m => m.zoominstellingen.zoom),
      observeOnAngular(this.zone)
    );
  }

  zetMijnPositie(zoom: boolean, position: Position) {
    if (zoom) {
      // We zitten nu op heel Vlaanderen, dus gaan we eerst inzoomen.
      this.dispatcher.dispatch(prt.VeranderZoomCmd(this.zoomniveau, kaartLogOnlyWrapper));
    }

    const longLat: ol.Coordinate = [position.coords.longitude, position.coords.latitude];

    const coordinate = ol.proj.fromLonLat(longLat, "EPSG:31370");
    this.dispatcher.dispatch(prt.VeranderMiddelpuntCmd(coordinate));

    this.mijnLocatie = orElse(this.mijnLocatie.chain(feature => KaartMijnLocatieComponent.pasFeatureAan(feature, coordinate)), () =>
      this.maakNieuwFeature(coordinate)
    );
  }

  maakNieuwFeature(coordinate: ol.Coordinate): Option<ol.Feature> {
    const feature = new ol.Feature(new ol.geom.Point(coordinate));
    feature.setStyle(this.mijnLocatieStyle);
    this.dispatcher.dispatch(prt.VervangFeaturesCmd(MijnLocatieLaagNaam, List.of(feature), kaartLogOnlyWrapper));
    return some(feature);
  }

  meldFout(fout: PositionError | string) {
    kaartLogger.error("error", fout);
    this.dispatcher.dispatch(
      prt.MeldComponentFoutCmd(
        List.of("Zoomen naar huidige locatie niet mogelijk", "De toepassing heeft geen toestemming om locatie te gebruiken")
      )
    );
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
