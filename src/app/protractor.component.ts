import { Component, ViewEncapsulation } from "@angular/core";

import * as ol from "projects/ng-kaart/src/lib/util/openlayers-compat";

@Component({
  selector: "awv-protractor",
  templateUrl: "./protractor.component.html",
  encapsulation: ViewEncapsulation.None
})
export class ProtractorComponent {
  pinIcon = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
      anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
      scale: 1,
      opacity: 1,
      src: require("material-design-icons/maps/svg/production/ic_place_48px.svg")
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

  pinIcon2 = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
      anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
      scale: 1,
      opacity: 1,
      color: "#FA1",
      src: require("material-design-icons/maps/svg/production/ic_local_airport_48px.svg")
    }),
    text: new ol.style.Text({
      font: "12px 'Helvetica Neue', sans-serif",
      fill: new ol.style.Fill({ color: "#0AF" }),
      offsetY: -60,
      stroke: new ol.style.Stroke({
        color: "#fff",
        width: 2
      }),
      text: "Feature 2"
    })
  });

  installatieCoordinaat: ol.Coordinate = [169500, 190500];
  installatie: ol.Feature[] = [
    new ol.Feature({
      id: 1,
      laagnaam: "Fietspaden",
      properties: {
        ident8: "R0010001",
        typefietspad: "Vrijliggend"
      },
      geometry: new ol.geom.Point(this.installatieCoordinaat)
    })
  ];
}
