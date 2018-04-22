import { Component, Input } from "@angular/core";
import * as ol from "openlayers";

import { KaartClassicComponent } from "./kaart-classic.component";
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
  selector: "awv-kaart-teken-settings",
  template: "<ng-content></ng-content>"
})
export class KaartTekenenSettingsComponent {
  private _geometryType: ol.geom.GeometryType = "LineString";
  @Input()
  set geometryType(gtype: ol.geom.GeometryType) {
    this._geometryType = gtype;
    this.propagateSettings();
  }
  private _laagStyle = defaultLaagStyle;
  @Input()
  set laagStyle(style: ol.style.Style) {
    this._laagStyle = style;
    this.propagateSettings();
  }
  private _drawStyle = defaultDrawStyle;
  @Input()
  set drawStyle(style: ol.style.Style) {
    this._drawStyle = style;
    this.propagateSettings();
  }

  constructor(readonly kaart: KaartClassicComponent) {
    this.propagateSettings();
  }

  propagateSettings() {
    this.kaart.tekenSettings = TekenSettings(this._geometryType, this._laagStyle, this._drawStyle);
  }
}
