import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-image-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendeImageItemComponent extends ClassicLegendeItemComponent {
  @Input()
  image: string;

  constructor(injector: Injector) {
    super(injector);
  }

  maakLegendeItem(): LegendeItem {
    return {
      type: "Image",
      beschrijving: this.beschrijving,
      image: this.image
    };
  }
}
