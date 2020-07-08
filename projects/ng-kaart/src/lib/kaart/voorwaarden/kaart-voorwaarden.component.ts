import { Component, NgZone } from "@angular/core";
import * as rx from "rxjs";

import * as prt from "../kaart-protocol";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";
import { OptiesRecord } from "../ui-element-opties";

export const VoorwaardenSelector = "Voorwaarden";

export interface VoorwaardenOpties extends OptiesRecord {
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
  voorwaardenOpties$: rx.Observable<VoorwaardenOpties>;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
    this.dispatch(prt.InitUiElementOpties(VoorwaardenSelector, defaultOpties));
    this.voorwaardenOpties$ = this.accumulatedOpties$(VoorwaardenSelector);
  }
}
