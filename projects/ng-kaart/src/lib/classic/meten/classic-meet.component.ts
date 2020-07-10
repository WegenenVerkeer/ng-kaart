import { Component, Injector, Input } from "@angular/core";

import { MetenOpties, MetenUiSelector } from "../../kaart/meten/kaart-meten.component";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";
import * as val from "../webcomponent-support/params";

/**
 * De component zorgt voor een knop aan de rechterkant waarmee een meet-tool geactiveerd kan worden. <em>Dit is een oude
 * versie enkel aanwezig voor backwards compatibility, gebruik bij voorkeur
 * <code>&lt;awv-kaart-multi-meet-knop&gt;</code>.</em>
 */
@Component({
  selector: "awv-meet-knop",
  template: ""
})
export class ClassicMetenComponent extends ClassicUIElementSelectorDirective {
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
