import { Component, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import * as prt from "../kaart-protocol";
import { OptiesRecord } from "../ui-element-opties";

export const CopyrightUISelector = "Copyright";

export interface CopyrightOpties extends OptiesRecord {
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
    this.dispatch(prt.InitUiElementOpties(CopyrightUISelector, defaultOpties));

    this.copyright$ = this.accumulatedOpties$<CopyrightOpties>(CopyrightUISelector).pipe(map(o => o.copyright));
  }
}
