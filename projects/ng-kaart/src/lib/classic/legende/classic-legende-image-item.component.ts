import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import * as val from "../webcomponent-support/params";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-image-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendeImageItemComponent extends ClassicLegendeItemComponent {
  _image: string;

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
