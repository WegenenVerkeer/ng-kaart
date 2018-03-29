import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";

import { KaartLaagComponent } from "./kaart-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { WmsLaag, TiledWmsType } from "./kaart-elementen";
import { fromNullable } from "fp-ts/lib/Option";
import { Laaggroep } from "./kaart-protocol-commands";

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWmsLaagComponent extends KaartLaagComponent implements OnInit {
  @Input() laagNaam: string;
  @Input() urls: string[];
  @Input() tiled = true;
  @Input() type: string;
  @Input() versie?: string;
  @Input() format? = "image/png";
  @Input() tileSize? = 256;
  @Input() groep: Laaggroep = "Achtergrond";

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  ngOnInit() {
    if (["Voorgrond", "Achtergrond"].indexOf(this.groep) < 0) {
      throw new Error("groep moet 'Voorgrond' of 'Achtergrond' zijn");
    }
    super.ngOnInit();
  }

  createLayer(): WmsLaag {
    return {
      type: TiledWmsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: List(this.urls),
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format)
    };
  }

  laaggroep(): Laaggroep {
    return this.groep;
  }
}
