import { Component, Injector, OnDestroy, OnInit } from "@angular/core";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { ClassicBaseDirective } from "../classic-base.directive";

/**
 * Voegt een knop toe waarmee de kaart naar en van volledige-scherm-modus geschakeld kan worden.
 */
@Component({
  selector: "awv-kaart-knop-volledig-scherm",
  template: "<ng-content></ng-content>",
})
export class ClassicVolledigSchermComponent
  extends ClassicBaseDirective
  implements OnInit, OnDestroy {
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch({
      type: "VoegVolledigSchermToe",
      wrapper: kaartLogOnlyWrapper,
    });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch({
      type: "VerwijderVolledigScherm",
      wrapper: kaartLogOnlyWrapper,
    });
  }
}
