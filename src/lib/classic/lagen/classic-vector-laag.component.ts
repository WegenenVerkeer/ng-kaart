import { Component, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { OrderedMap } from "immutable";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { getDefaultSelectionStyleFunction, getDefaultStyleFunction } from "../../kaart/styles";
import { forEach, orElse } from "../../util/option";
import { KaartClassicComponent } from "../kaart-classic.component";

import { ClassicLaagComponent } from "./classic-laag.component";

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicVectorLaagComponent extends ClassicLaagComponent {
  @Input() source = new ol.source.Vector();
  @Input() style?: ol.style.Style = undefined; // heeft voorrang op styleFunction
  @Input() styleFunction?: ol.StyleFunction = getDefaultStyleFunction(); // TODO combineren met style tot type Stylish
  @Input() selectieStyle?: ss.Stylish = getDefaultSelectionStyleFunction();
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minZoom = 7;
  @Input() maxZoom = 15;
  @Input() offsetveld?: string = undefined;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: this.source,
      styleSelector: this.getMaybeStyleSelector(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      selecteerbaar: this.selecteerbaar,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      offsetveld: fromNullable(this.offsetveld),
      velden: OrderedMap<string, ke.VeldInfo>()
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Hoog";
  }

  private getMaybeStyleSelector(): Option<ss.StyleSelector> {
    return orElse(fromNullable(this.style).map(ss.StaticStyle), () => fromNullable(this.styleFunction).map(ss.DynamicStyle));
  }

  voegLaagToe() {
    super.voegLaagToe();

    forEach(this.getMaybeStyleSelector(), styleselector => {
      this.dispatch(
        prt.ZetStijlVoorLaagCmd(this.titel, styleselector, fromNullable(this.selectieStyle).chain(ss.asStyleSelector), kaartLogOnlyWrapper)
      );
    });
  }
}
