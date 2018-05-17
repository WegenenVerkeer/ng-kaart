import { Component, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { OrderedMap } from "immutable";
import * as ol from "openlayers";

import { forEach, orElse } from "../util/option";

import { KaartClassicComponent } from "./kaart-classic.component";
import * as ke from "./kaart-elementen";
import { StyleSelector, Stylish } from "./kaart-elementen";
import { determineStyleSelector } from "./kaart-elementen";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import { KaartLaagComponent } from "./kaart-laag.component";
import * as prt from "./kaart-protocol";
import { getDefaultSelectionStyleFunction, getDefaultStyleFunction } from "./styles";

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartVectorLaagComponent extends KaartLaagComponent {
  @Input() source = new ol.source.Vector();
  @Input() style?: ol.style.Style = undefined;
  @Input() styleFunction?: ol.StyleFunction = getDefaultStyleFunction();
  @Input() selectieStyle?: Stylish = getDefaultSelectionStyleFunction();
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minZoom = 7;
  @Input() maxZoom = 15;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: this.source,
      styleSelector: orElse(fromNullable(this.style).map(ke.StaticStyle), () => fromNullable(this.styleFunction).map(ke.DynamicStyle)),
      selecteerbaar: this.selecteerbaar,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      velden: OrderedMap()
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Hoog";
  }

  private getMaybeStyleSelector(): Option<StyleSelector> {
    return orElse(fromNullable(this.style).map(ke.StaticStyle), () => fromNullable(this.styleFunction).map(ke.DynamicStyle));
  }

  voegLaagToe() {
    super.voegLaagToe();

    forEach(this.getMaybeStyleSelector(), styleselector => {
      this.dispatch(
        prt.ZetStijlVoorLaagCmd(
          this.titel,
          styleselector,
          fromNullable(this.selectieStyle).chain(determineStyleSelector),
          kaartLogOnlyWrapper
        )
      );
    });
  }
}
