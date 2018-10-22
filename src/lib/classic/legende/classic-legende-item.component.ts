import { Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";

export abstract class ClassicLegendeItemComponent {
  @Input()
  beschrijving: string;

  abstract maakLegendeItem(): LegendeItem;
}
