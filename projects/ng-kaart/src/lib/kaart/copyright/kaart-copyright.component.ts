import { Component, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { filter, map, startWith } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

export const CopyrightUISelector = "Copyright";

export interface CopyrightOpties {
  readonly copyright: string;
}

export const CopyrightOpties = (copyright: string) => ({ copyright: copyright });

const defaultOpties: CopyrightOpties = {
  copyright: "\u00A9 Agentschap Wegen en Verkeer"
};

@Component({
  selector: "awv-copyright",
  templateUrl: "./kaart-copyright.component.html",
  styleUrls: ["./kaart-copyright.component.scss"]
})
export class KaartCopyrightComponent extends KaartChildComponentBase {
  copyright$: rx.Observable<string>;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
    this.copyright$ = this.modelChanges.uiElementOpties$.pipe(
      filter(optie => optie.naam === CopyrightUISelector),
      map(o => o.opties.copyright),
      startWith(defaultOpties.copyright)
    );
  }
}
