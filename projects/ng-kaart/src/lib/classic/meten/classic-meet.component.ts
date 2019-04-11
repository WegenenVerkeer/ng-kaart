import { Component, Injector, Input } from "@angular/core";

import { MetenOpties, MetenUiSelector } from "../../kaart/meten/kaart-meten.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import * as val from "../webcomponent-support/params";

@Component({
  selector: "awv-meet-knop",
  template: ""
})
export class ClassicMetenComponent extends ClassicUIElementSelectorComponentBase {
  _toonInfoBoodschap = true;
  _meerdereGeometrieen = true;

  @Input()
  set toonInfoBoodschap(param: boolean) {
    this._toonInfoBoodschap = val.bool(param, this._toonInfoBoodschap);
  }

  @Input()
  set meerdereGeometrieen(param: boolean) {
    this._meerdereGeometrieen = val.bool(param, this._meerdereGeometrieen);
  }

  constructor(injector: Injector) {
    super(MetenUiSelector, injector);
  }

  protected opties(): MetenOpties {
    return {
      toonInfoBoodschap: this._toonInfoBoodschap,
      meerdereGeometrieen: this._meerdereGeometrieen
    };
  }
}
