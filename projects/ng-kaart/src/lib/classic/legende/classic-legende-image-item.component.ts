import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import * as val from "../webcomponent-support/params";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

/**
 * De component moet als child tag van een laag gebruikt worden, Wanneer de elementen op de laag zichtbaar zijn, wordt
 * dan in de lagenkiezer een lijn getoond met dit legende-item.
 *
 * Gebruik deze component voor laagelementen die als een icoon weergegeven worden.
 */

@Component({
  selector: "awv-legende-image-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendeImageItemComponent extends ClassicLegendeItemComponent {
  _image: string;

  /**
   * De URL van een icoontje. Voor de beste performantie kan een base-64 geëncodeerde afbeelding bebruikt worden.
   */
  @Input()
  set image(param: string) {
    this._image = val.str(param, this._image);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  maakLegendeItem(): LegendeItem {
    return {
      type: "Image",
      beschrijving: this._beschrijving,
      image: this._image
    };
  }
}
