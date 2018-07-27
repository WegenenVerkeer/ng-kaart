import { Component, NgZone } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { filter, map, startWith } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

export const VoorwaardenSelector = "Voorwaarden";

export interface VoorwaardenOpties {
  titel: string;
  href: string;
}

export const VoorwaardenOpties = (titel: string, href: string) => ({ titel: titel, href: href });

const defaultOpties: VoorwaardenOpties = {
  titel: "Voorwaarden",
  href: "https://www.vlaanderen.be/nl/disclaimer"
};

@Component({
  selector: "awv-voorwaarden",
  templateUrl: "./kaart-voorwaarden.component.html",
  styleUrls: ["./kaart-voorwaarden.component.scss"]
})
export class KaartVoorwaardenComponent extends KaartChildComponentBase {
  voorwaardenOpties$: Observable<VoorwaardenOpties>;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
    this.voorwaardenOpties$ = this.modelChanges.uiElementOpties$.pipe(
      filter(optie => optie.naam === VoorwaardenSelector),
      map(o => o.opties as VoorwaardenOpties),
      startWith(defaultOpties)
    );
  }
}
