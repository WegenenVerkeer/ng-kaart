import { Component, Input } from "@angular/core";
import * as ol from "openlayers";

import { KaartClassicComponent } from "./kaart-classic.component";
import { TekenSettings } from "./kaart-elementen";

@Component({
  selector: "awv-kaart-teken-settings",
  template: "<ng-content></ng-content>"
})
export class KaartTekenenSettingsComponent {
  private _geometryType: ol.geom.GeometryType = "LineString";
  @Input()
  set geometryType(gtype: ol.geom.GeometryType) {
    this._geometryType = gtype;
    this.propagateTekenSettings();
  }
  private _laagStyle;
  @Input()
  set laagStyle(style: ol.style.Style) {
    this._laagStyle = style;
    this.propagateTekenSettings();
  }
  private _drawStyle;
  @Input()
  set drawStyle(style: ol.style.Style) {
    this._drawStyle = style;
    this.propagateTekenSettings();
  }

  constructor(readonly kaart: KaartClassicComponent) {
    this.propagateTekenSettings();
  }

  propagateTekenSettings() {
    this.kaart.tekenSettings = TekenSettings(this._geometryType, this._laagStyle, this._drawStyle);
  }
}
