import { Component, Input, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";
import * as ol from "openlayers";

import * as ke from "./kaart-elementen";
import { KaartLaagComponent } from "./kaart-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWmsLaagComponent extends KaartLaagComponent {
  @Input() laagNaam: string;
  @Input() urls: string[];
  @Input() tiled = true;
  @Input() type: string;
  @Input() versie?: string;
  @Input() extent?: ol.Extent = [18000.0, 152999.75, 280144.0, 415143.75];

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.ElementType.WMSLAAG,
      titel: this.titel,
      naam: this.laagNaam,
      extent: this.extent,
      urls: List(this.urls),
      versie: this.versie
    };
  }
}
