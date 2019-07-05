import { Component, Injector, Input } from "@angular/core";

import { defaultMarkerStyle as defaultClickMarkerStyle, MarkeerKaartklikOpties, MarkeerKaartklikUiSelector } from "../../kaart";
import * as ss from "../../kaart/stijl-selector";
import { toOption } from "../../util";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import * as val from "../webcomponent-support/params";

/**
 * Voegt gedrag toe waardoor een klik op de kaart aangeduid kan worden met één of ander symbool. Een typisch voorbeeld
 * is het locatieballonnetje zoals Google Maps dat gebruikt.
 */
@Component({
  selector: "awv-kaart-markeer-kaartklik",
  template: ""
})
export class ClassicMarkeerKaartklikComponent extends ClassicUIElementSelectorComponentBase {
  private _markerStyle: ss.Stylish = defaultClickMarkerStyle;
  private _disabled = false;

  constructor(injector: Injector) {
    super(MarkeerKaartklikUiSelector, injector);
  }

  protected opties(): MarkeerKaartklikOpties {
    return {
      markerStyle: this._markerStyle,
      disabled: this._disabled
    };
  }

  /** Zet de stijl van de markeerfeature als een Stijlspec */
  @Input()
  set markeerStijlSpec(stijlSpec: ss.AwvV0StyleSpec) {
    this._markerStyle = val
      .optStyleSpec(stijlSpec)
      .map(stijlSpec => ss.validateAwvV0StyleSpec(stijlSpec))
      .chain(validation => toOption(validation))
      .getOrElse(this._markerStyle);
  }

  /** Zet de stijl van de markeerfeature direct als een openlayer stijl. Niet bruikbaar op een web element*/
  @Input()
  set markeerStijl(stijl: ss.Stylish) {
    this._markerStyle = stijl;
  }

  /**
   * Onderdruk het tonen van de geklikte locatie. Zorgt er ook voor dat de recentst gemarkeerde locatie gewist wordt.
   * Dit is dus ook een manier om de recentst gemarkeerde locatie te wissen (kort na elkaar af en aan zetten).
   */
  @Input()
  set disabled(disabled: boolean) {
    this._disabled = val.bool(disabled, this._disabled);
  }
}
