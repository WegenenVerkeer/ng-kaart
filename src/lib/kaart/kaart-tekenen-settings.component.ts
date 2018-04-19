import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation, Input } from "@angular/core";
import * as ol from "openlayers";
import { TekenSettings } from "./kaart-elementen";

const defaultLaagStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "rgba(255, 255, 255, 0.2)"
  }),
  stroke: new ol.style.Stroke({
    color: "#ffcc33",
    width: 2
  }),
  image: new ol.style.Circle({
    radius: 7,
    fill: new ol.style.Fill({
      color: "#ffcc33"
    })
  })
});
const defaultDrawStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "rgba(255, 255, 255, 0.2)"
  }),
  stroke: new ol.style.Stroke({
    color: "rgba(0, 0, 0, 0.5)",
    lineDash: [10, 10],
    width: 2
  }),
  image: new ol.style.Circle({
    radius: 5,
    stroke: new ol.style.Stroke({
      color: "rgba(0, 0, 0, 0.7)"
    }),
    fill: new ol.style.Fill({
      color: "rgba(255, 255, 255, 0.2)"
    })
  })
});

@Component({
  selector: "awv-kaart-tekenen-settings",
  template: "<ng-content></ng-content>"
})
export class KaartTekenenSettingsComponent {
  @Input() geometryType: ol.geom.GeometryType = "LineString";
  @Input() laagStyle = defaultLaagStyle;
  @Input() drawStyle = defaultDrawStyle;

  get tekenSettings(): TekenSettings {
    return TekenSettings(this.geometryType, this.laagStyle, this.drawStyle);
  }
}
