import { Component, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";
import { orElse } from "../util/option";
import { Laaggroep } from "./kaart-protocol-commands";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { StyleSelector } from "./kaart-elementen";
import { getDefaultSelectionStyleFunction, getDefaultStyleFunction } from "./styles";
import { some } from "fp-ts/lib/Option";
import { option } from "fp-ts";

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartVectorLaagComponent extends KaartLaagComponent {
  @Input() source = new ol.source.Vector();
  @Input() style?: ol.style.Style = undefined;
  @Input() styleFunction?: ol.StyleFunction = getDefaultStyleFunction();
  @Input() selectieStyle?: ol.style.Style | ol.style.Style[] | ol.StyleFunction = getDefaultSelectionStyleFunction();
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
      maxZoom: this.maxZoom
    };
  }

  laaggroep(): Laaggroep {
    return "Voorgrond";
  }

  voegLaagToe() {
    super.voegLaagToe();
    this.dispatch(
      prt.ZetStijlVoorLaagCmd(
        this.titel,
        orElse(option.fromNullable(this.style).map(ke.StaticStyle), () =>
          option.fromNullable(this.styleFunction).map(ke.DynamicStyle)
        ).getOrElseValue(StyleSelector(getDefaultStyleFunction())),
        option.fromNullable(this.selectieStyle).map(StyleSelector),
        kaartLogOnlyWrapper
      )
    );
  }
}
