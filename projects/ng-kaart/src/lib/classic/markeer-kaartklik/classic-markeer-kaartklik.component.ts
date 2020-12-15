import { Component, Injector, Input } from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";

import {
  defaultMarkerStyle as defaultClickMarkerStyle,
  MarkeerKaartklikOpties,
  MarkeerKaartklikUiSelector,
} from "../../kaart";
import * as ss from "../../kaart/stijl-selector";
import { toOption } from "../../util";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";
import * as val from "../webcomponent-support/params";

/**
 * Voegt gedrag toe waardoor een klik op de kaart aangeduid kan worden met één of ander symbool. Een typisch voorbeeld
 * is het locatieballonnetje zoals Google Maps dat gebruikt.
 */
@Component({
  selector: "awv-kaart-markeer-kaartklik",
  template: "",
})
export class ClassicMarkeerKaartklikComponent extends ClassicUIElementSelectorDirective {
  private _markerStyle: ss.Stylish = defaultClickMarkerStyle;
  private _disabled = false;
  private _includeFeatureClick = false;

  constructor(injector: Injector) {
    super(MarkeerKaartklikUiSelector, injector);
  }

  protected opties(): MarkeerKaartklikOpties {
    return {
      markerStyle: this._markerStyle,
      disabled: this._disabled,
      includeFeatureClick: this._includeFeatureClick,
      id: "classic_opties",
    };
  }

  /** Zet de stijl van de markeerfeature als een Stijlspec */
  @Input()
  set markeerStijlSpec(stijlSpec: ss.AwvV0StyleSpec) {
    this._markerStyle = pipe(
      val.optStyleSpec(stijlSpec),
      option.map((stijlSpec) => ss.validateAwvV0StyleSpec(stijlSpec)),
      option.chain((validation) => toOption(validation)),
      option.getOrElse(() => this._markerStyle)
    );
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

  /**
   * Enkel wanneer dit op `true` staat wordt het icoontje getoond wanneer op een feature geklikt wordt. De
   * standaardwaarde is false.
   */
  @Input()
  set includeFeatureClick(include: boolean) {
    this._includeFeatureClick = val.bool(include, this._includeFeatureClick);
  }
}
