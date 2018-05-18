import { Component, NgZone } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { filter, map } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

export const CopyrightSelector = "Copyright";
export const SchaalSelector = "Schaal";

export interface CopyrightOpties {
  copyright: string;
}

export const CopyrightOpties = (copyright: string) => ({ copyright: copyright });

@Component({
  selector: "awv-copyright",
  templateUrl: "./kaart-copyright.html",
  styleUrls: ["./kaart-copyright.scss"]
})
export class KaartCopyrightComponent extends KaartChildComponentBase {
  copyright$: Observable<string>;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
    this.copyright$ = this.modelChanges.uiElementOpties$.pipe(
      filter(optie => optie.naam === CopyrightSelector),
      map(o => o.opties.copyright)
    );
  }
}
