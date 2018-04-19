import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";

import { KaartLaagComponent } from "./kaart-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { WmsLaag, TiledWmsType, WmtsLaag, WmtsType } from "./kaart-elementen";
import { fromNullable } from "fp-ts/lib/Option";
import { Laaggroep } from "./kaart-protocol-commands";

@Component({
  selector: "awv-kaart-wmts-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWmtsLaagComponent extends KaartLaagComponent implements OnInit {
  @Input() laagNaam: string;
  @Input() urls: string[];
  @Input() tiled = true;
  @Input() type: string;
  @Input() versie?: string;
  @Input() format? = "image/png";
  @Input() opacity?: number;
  @Input() groep: Laaggroep = "Achtergrond";
  @Input() matrixIds: string[];
  @Input() style?: string;
  @Input() matrixSet: string;
  @Input() origin?: [number, number];

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  ngOnInit() {
    if (["Voorgrond", "Achtergrond"].indexOf(this.groep) < 0) {
      throw new Error("groep moet 'Voorgrond' of 'Achtergrond' zijn");
    }
    super.ngOnInit();
  }

  createLayer(): WmtsLaag {
    return {
      type: WmtsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: List(this.urls),
      versie: fromNullable(this.versie),
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      matrixIds: this.matrixIds,
      style: fromNullable(this.style),
      matrixSet: this.matrixSet,
      origin: fromNullable(this.origin)
    };
  }

  laaggroep(): Laaggroep {
    return this.groep;
  }
}
