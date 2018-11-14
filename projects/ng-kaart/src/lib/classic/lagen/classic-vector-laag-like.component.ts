import { Input, NgZone } from "@angular/core";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";

import * as ke from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { getDefaultHoverStyleFunction, getDefaultSelectionStyleFunction, getDefaultStyleFunction } from "../../kaart/styles";
import { forEach, fromValidation } from "../../util/option";
import { KaartClassicComponent } from "../kaart-classic.component";
import { logOnlyWrapper } from "../messages";

import { ClassicLaagComponent } from "./classic-laag.component";

export abstract class ClassicVectorLaagLikeComponent extends ClassicLaagComponent {
  @Input()
  stijlSpec?: ss.Awv0StyleSpec = undefined; // heeft voorrang style
  @Input()
  style?: ol.style.Style = undefined; // heeft voorrang op styleFunction
  @Input()
  styleFunction?: ol.StyleFunction = getDefaultStyleFunction(); // TODO combineren met style tot type Stylish
  @Input()
  selectieStyle?: ss.Stylish = getDefaultSelectionStyleFunction();
  @Input()
  hoverStyle?: ss.Stylish = getDefaultHoverStyleFunction();
  @Input()
  zichtbaar = true;
  @Input()
  selecteerbaar = true;
  @Input()
  hover = false;
  @Input()
  minZoom = 7;
  @Input()
  maxZoom = 15;
  @Input()
  offsetveld?: string = undefined;
  private refreshTriggerSub: rx.Subscription = new rx.Subscription();
  @Input()
  set refreshTrigger(obs: rx.Observable<void>) {
    this.refreshTriggerSub.unsubscribe();
    this.refreshTriggerSub = this.bindToLifeCycle(obs).subscribe(() =>
      forEach(this.laag.chain(ke.asVectorLaag), laag => laag.source.clear())
    );
  }

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(kaart, zone);
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Hoog";
  }

  protected getMaybeStyleSelectorBron(): Option<ss.Awv0StyleSpec> {
    return fromNullable(this.stijlSpec);
  }

  protected getMaybeStyleSelector(): Option<ss.StyleSelector> {
    return fromNullable(this.stijlSpec)
      .chain(spec => fromValidation(ss.validateAwv0Style(spec)))
      .orElse(() => fromNullable(this.style))
      .map(ss.StaticStyle)
      .orElse(() => fromNullable(this.styleFunction).map(ss.DynamicStyle));
  }

  voegLaagToe() {
    super.voegLaagToe();

    forEach(this.getMaybeStyleSelector(), styleselector => {
      this.dispatch(
        prt.ZetStijlVoorLaagCmd(this.titel, styleselector, fromNullable(this.selectieStyle).chain(ss.asStyleSelector), logOnlyWrapper)
      );
    });
  }
}
