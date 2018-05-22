import { Component, Input, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { OrderedMap } from "immutable";
import * as ol from "openlayers";

import { NosqlFsSource } from "../source/nosql-fs-source";
import { forEach, orElse } from "../util/option";

import { KaartClassicComponent } from "./kaart-classic.component";
import * as ke from "./kaart-elementen";
import { VeldInfo } from "./kaart-elementen";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import { KaartLaagComponent } from "./kaart-laag.component";
import * as prt from "./kaart-protocol";
import * as ss from "./stijl-selector";
import { getDefaultSelectionStyleFunction, getDefaultStyleFunction } from "./styles";

@Component({
  selector: "awv-kaart-nosqlfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartNosqlfsLaagComponent extends KaartLaagComponent {
  @Input() url = "/geolatte-nosqlfs";
  @Input() database: string;
  @Input() collection: string;
  @Input() style?: ol.style.Style = undefined; // heeft voorrang op styleFunction
  @Input() styleFunction: ol.StyleFunction = getDefaultStyleFunction(); // TODO combineren met style tot type Stylish
  @Input() selectieStyle: ss.Stylish = getDefaultSelectionStyleFunction();
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minZoom = 7;
  @Input() maxZoom = 15;
  @Input() view = "default";
  @Input() filter: string;
  @Input() offsetveld?: string = undefined;

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
      styleSelector: this.getMaybeStyleSelector(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      selecteerbaar: this.selecteerbaar,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      offsetveld: fromNullable(this.offsetveld),
      velden: OrderedMap<string, VeldInfo>()
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
