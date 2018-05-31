import { Component, forwardRef, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-image-item",
  template: "<ng-content></ng-content>",
  // De volgende lijn is nodig om de @ContentChildren(ClassicLegendeItemComponent) te laten werken
  providers: [{ provide: ClassicLegendeItemComponent, useExisting: forwardRef(() => ClassicLegendeImageItemComponent) }]
})
export class ClassicLegendeImageItemComponent extends ClassicLegendeItemComponent {
  @Input() image: string;

  maakLegendeItem(): LegendeItem {
    return {
      type: "Image",
      beschrijving: this.beschrijving,
      image: this.image
    };
  }
}
