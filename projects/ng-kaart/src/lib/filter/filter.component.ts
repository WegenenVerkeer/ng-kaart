import { Component, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { map } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";

import { isAanpassingBezig } from "./filter-aanpassing-state";

@Component({
  selector: "awv-filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent extends KaartChildComponentBase {
  readonly zichtbaar$: rx.Observable<boolean>;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    this.zichtbaar$ = kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig));
  }

  close() {
    this.dispatch(prt.StopVectorFilterBewerkingCmd());
  }

  pasToe() {
    // this.dispatch(cmd.ZetFilter(this.laag.titel, some(IsExactFilter(Property("string", "ident8"), "R0010001")), kaartLogOnlyWrapper));
  }
}
