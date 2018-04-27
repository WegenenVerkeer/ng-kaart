import { Component, Input, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";
import { some } from "fp-ts/lib/Option";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";
import { NosqlFsSource } from "../source/nosql-fs-source";
import { orElse } from "../util/option";
import { Laaggroep, ZetStijlVoorLaagCmd } from "./kaart-protocol-commands";
import { StaticStyle, DynamicStyle, Styles, StyleSelector } from "./kaart-elementen";
import { getDefaultStyleFunction, getDefaultSelectionStyleFunction } from "./styles";
import { fromNullable } from "fp-ts/lib/Option";
import * as prt from "./kaart-protocol";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";

@Component({
  selector: "awv-kaart-nosqlfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartNosqlfsLaagComponent extends KaartLaagComponent {
  @Input() url = "/geolatte-nosqlfs";
  @Input() database: string;
  @Input() collection: string;
  @Input() style?: ol.style.Style = undefined;
  @Input() styleFunction?: ol.StyleFunction = getDefaultStyleFunction();
  @Input() selectieStyle?: ol.style.Style | ol.style.Style[] | ol.StyleFunction = getDefaultSelectionStyleFunction();
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minZoom = 7;
  @Input() maxZoom = 15;
  @Input() view = "default";
  @Input() filter: string;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: new NosqlFsSource(
        this.database,
        this.collection,
        this.url,
        option.fromNullable(this.view),
        option.fromNullable(this.filter),
        this.titel
      ),
      styleSelector: orElse(option.fromNullable(this.style).map(ke.StaticStyle), () =>
        option.fromNullable(this.styleFunction).map(ke.DynamicStyle)
      ),
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
