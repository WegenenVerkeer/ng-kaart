import { Component, Input, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";
import { some, Option, none } from "fp-ts/lib/Option";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";
import { NosqlFsSource } from "../source/nosql-fs-source";
import { orElse, forEach } from "../util/option";
import { Laaggroep, ZetStijlVoorLaagCmd } from "./kaart-protocol-commands";
import { StaticStyle, DynamicStyle, Styles, StyleSelector } from "./kaart-elementen";
import { getDefaultStyleFunction, getDefaultSelectionStyleFunction } from "./styles";
import { fromNullable } from "fp-ts/lib/Option";
import * as prt from "./kaart-protocol";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import { determineStyle, determineStyleSelector } from "./kaart-elementen";

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
