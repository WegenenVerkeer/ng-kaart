import { AfterViewInit, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { filter, map } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

export const VoorwaardenSelector = "Voorwaarden";

export interface VoorwaardenOpties {
  titel: string;
  href: string;
}

export const VoorwaardenOpties = (titel: string, href: string) => ({ titel: titel, href: href });

@Component({
  selector: "awv-voorwaarden",
  templateUrl: "./kaart-voorwaarden.html",
  styleUrls: ["./kaart-voorwaarden.scss"]
})
export class KaartVoorwaardenComponent extends KaartChildComponentBase {
  voorwaardenOpties$: Observable<VoorwaardenOpties>;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
    this.voorwaardenOpties$ = this.modelChanges.uiElementOpties$.pipe(
      filter(optie => optie.naam === VoorwaardenSelector),
      map(o => o.opties as VoorwaardenOpties)
    );
  }
}
