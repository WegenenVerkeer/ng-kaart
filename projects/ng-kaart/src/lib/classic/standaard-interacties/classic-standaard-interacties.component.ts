import { Component, Injector, Input, OnChanges, OnDestroy, SimpleChanges, ViewEncapsulation } from "@angular/core";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { ClassicBaseComponent } from "../classic-base.component";

import * as val from "../webcomponent-support/params";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicStandaardInteractiesComponent extends ClassicBaseComponent implements OnDestroy, OnChanges {
  private standaardInteractieToegevoegd = false;
  _focusVoorZoom = false;
  _rotatie = false;

  @Input()
  set focusVoorZoom(param: boolean) {
    this._focusVoorZoom = val.bool(param, this._focusVoorZoom);
  }

  @Input()
  set rotatie(param: boolean) {
    this._rotatie = val.bool(param, this._rotatie);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
    this.standaardInteractieToegevoegd = false;
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes.focusVoorZoom || changes.rotatie) && this.standaardInteractieToegevoegd) {
      this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
    }
    this.kaart.dispatch(prt.VoegStandaardInteractiesToeCmd(this._focusVoorZoom, this._rotatie, kaartLogOnlyWrapper));
    this.standaardInteractieToegevoegd = true;
  }
}
