import { Component, Injector, OnDestroy, OnInit } from "@angular/core";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { ClassicBaseComponent } from "../classic-base.component";

@Component({
  selector: "awv-kaart-knop-volledig-scherm",
  template: "<ng-content></ng-content>"
})
export class ClassicVolledigSchermComponent extends ClassicBaseComponent implements OnInit, OnDestroy {
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch({ type: "VoegVolledigSchermToe", wrapper: kaartLogOnlyWrapper });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch({ type: "VerwijderVolledigScherm", wrapper: kaartLogOnlyWrapper });
  }
}
