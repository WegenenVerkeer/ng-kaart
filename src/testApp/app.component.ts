import { Component } from "@angular/core";
import * as ol from "openlayers";
import "rxjs/add/operator/mergeMap";
import "rxjs/add/operator/map";

import { GoogleLocatieZoekerService } from "../lib/google-locatie-zoeker/google-locatie-zoeker.service";
import { CoordinatenService } from "../lib/kaart/coordinaten.service";

@Component({
  selector: "awv-ng-kaart-test-app",
  templateUrl: "./app.component.html"
})
export class AppComponent {
  polygoonEvents: string[] = [];
  installatieGeselecteerdEvents: string[] = [];
  geoJsonFormatter = new ol.format.GeoJSON();

  locatieQuery: string;
  installaties: ol.Feature[] = [];
  zoekresultaten: ol.Collection<ol.Feature> = new ol.Collection();

  installatie: ol.Coordinate = [169500, 190500];
  installatieExtent: ol.Extent = [180000, 190000, 181000, 191000];

  lat = 4.7970553;
  long = 51.0257317;

  private readonly pinIcon = new ol.style.Style({
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
      fill: new ol.style.Fill({ color: "#000" }),
      offsetY: -60,
      stroke: new ol.style.Stroke({
        color: "#fff",
        width: 2
      }),
      text: "Zis is a pin"
    })
  });

  constructor(private googleLocatieZoekerService: GoogleLocatieZoekerService, public coordinatenService: CoordinatenService) {
    this.addIcon();
  }

  private addIcon() {
    if (this.installaties.length > 20) {
      this.installaties = [];
    }
    const locatie: [number, number] = [
      this.installatie[0] + (Math.random() - 0.5) * 3000,
      this.installatie[1] + (Math.random() - 0.5) * 3000
    ];
    const feature = new ol.Feature(new ol.geom.Point(locatie));
    feature.setStyle(this.pinIcon);
    this.installaties.push(feature);
    setTimeout(() => this.addIcon(), 1000);
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
