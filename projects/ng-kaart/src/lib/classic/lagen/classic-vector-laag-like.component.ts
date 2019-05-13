import { Injector, Input } from "@angular/core";
import { fromNullable, none, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";

import * as ke from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { getDefaultHoverStyleFunction, getDefaultSelectionStyleFunction, getDefaultStyleFunction } from "../../kaart/styles";
import { forEach, fromValidation } from "../../util/option";
import { logOnlyWrapper } from "../messages";
import * as val from "../webcomponent-support/params";

import { ClassicLaagComponent } from "./classic-laag.component";

export abstract class ClassicVectorLaagLikeComponent extends ClassicLaagComponent {
  @Input()
  style?: ol.style.Style = undefined; // heeft voorrang op styleFunction
  @Input()
  styleFunction?: ol.StyleFunction = getDefaultStyleFunction(); // TODO combineren met style tot type Stylish
  @Input()
  selectieStyle?: ss.Stylish = getDefaultSelectionStyleFunction();
  @Input()
  hoverStyle?: ss.Stylish = getDefaultHoverStyleFunction();
  private refreshTriggerSub: rx.Subscription = new rx.Subscription();
  @Input()
  set refreshTrigger(obs: rx.Observable<void>) {
    this.refreshTriggerSub.unsubscribe();
    this.refreshTriggerSub = this.bindToLifeCycle(obs).subscribe(() =>
      forEach(this.laag.chain(ke.asVectorLaag), laag => laag.source.clear())
    );
  }

  _stijlSpec: Option<ss.AwvV0StyleSpec> = none; // heeft voorrang op style
  _clusterDistance: Option<number> = none;
  _zichtbaar = true;
  _selecteerbaar = true;
  _hover = false;
  _offsetveld: Option<string> = none;
  _minZoom = 7;
  _maxZoom = 15;

  @Input()
  set stijlSpec(param: ss.AwvV0StyleSpec) {
    this._stijlSpec = val.optStyleSpec(param);
  }

  @Input()
  set clusterDistance(param: number) {
    this._clusterDistance = val.optNum(param);
  }

  @Input()
  set zichtbaar(param: boolean) {
    this._zichtbaar = val.bool(param, this._zichtbaar);
  }

  @Input()
  set selecteerbaar(param: boolean) {
    this._selecteerbaar = val.bool(param, this._selecteerbaar);
  }

  @Input()
  set hover(param: boolean) {
    this._hover = val.bool(param, this._hover);
  }

  @Input()
  set offsetveld(param: string) {
    this._offsetveld = val.optStr(param);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Hoog";
  }

  protected getMaybeStyleSelectorBron(): Option<ss.AwvV0StyleSpec> {
    return this._stijlSpec;
  }

  protected getMaybeStyleSelector(): Option<ss.StyleSelector> {
    return this._stijlSpec
      .chain(spec => fromValidation(ss.validateAwvV0StyleSpec(spec)))
      .orElse(() => fromNullable(this.style))
      .map(ss.StaticStyle)
      .orElse(() => fromNullable(this.styleFunction).map(ss.DynamicStyle));
  }

  voegLaagToe() {
    super.voegLaagToe();

    forEach(this.getMaybeStyleSelector(), styleselector => {
      this.dispatch(
        prt.ZetStijlVoorLaagCmd(this._titel, styleselector, fromNullable(this.selectieStyle).chain(ss.asStyleSelector), logOnlyWrapper)
      );
    });
  }
}
