import {Component} from "@angular/core";
import * as ol from "openlayers";
import {GoogleLocatieZoekerService} from "../lib/google-locatie-zoeker/google-locatie-zoeker.service";
import "rxjs/add/operator/mergeMap";
import "rxjs/add/operator/map";
import {CoordinatenService} from "../lib/kaart/coordinaten.service";

@Component({
  selector: "ng-kaart-test-app",
  templateUrl: "./app.component.html"
})
export class AppComponent {
  polygoonEvents: string[] = [];
  installatieGeselecteerdEvents: string[] = [];
  geoJsonFormatter = new ol.format.GeoJSON();

  locatieQuery: string;
  installaties: ol.Collection<ol.Feature> = new ol.Collection();
  zoekresultaten: ol.Collection<ol.Feature> = new ol.Collection();

  installatie: ol.Coordinate = [180055.62, 190922.71];
  installatieExtent: ol.Extent = [180187.32699999958, 190705.7360999994, 180221.3849999979, 190732.32290000096];

  lat = 4.7970553;
  long = 51.0257317;

  constructor(private googleLocatieZoekerService: GoogleLocatieZoekerService, public coordinatenService: CoordinatenService) {
    const pinIcon = new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 1],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        scale: 1,
        opacity: 1,
        src: "./material-design-icons/maps/svg/production/ic_place_48px.svg"
      }),
      text: new ol.style.Text({
        font: "12px 'Helvetica Neue', sans-serif",
        fill: new ol.style.Fill({color: "#000"}),
        offsetY: -60,
        stroke: new ol.style.Stroke({
          color: "#fff",
          width: 2
        }),
        text: "Zis is a pin"
      })
    });

    const feature = new ol.Feature(new ol.geom.Point(this.installatie));
    feature.setStyle(pinIcon);
    this.installaties.push(feature);
  }

  polygoonGetekend(feature: ol.Feature) {
    this.polygoonEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  installatieGeselecteed(feature: ol.Feature) {
    this.installatieGeselecteerdEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  zoekLocaties(locatieQuery: String) {
    this.googleLocatieZoekerService
      .zoek(locatieQuery)
      .flatMap(res => res.resultaten)
      .map(zoekresultaat => zoekresultaat.geometry)
      .map(geometry => new ol.Feature(geometry))
      .subscribe(feature => this.zoekresultaten.push(feature));
  }
}
