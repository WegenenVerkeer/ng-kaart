import { Component, NgZone } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { filter, map, startWith } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

export const CopyrightUISelector = "Copyright";

export interface CopyrightOpties {
  copyright: string;
}

export const CopyrightOpties = (copyright: string) => ({ copyright: copyright });

const defaultOpties: CopyrightOpties = {
  copyright: "\u00A9 Agentschap Wegen en Verkeer"
};

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
      filter(optie => optie.naam === CopyrightUISelector),
      map(o => o.opties.copyright),
      startWith(defaultOpties.copyright)
    );
  }
}
