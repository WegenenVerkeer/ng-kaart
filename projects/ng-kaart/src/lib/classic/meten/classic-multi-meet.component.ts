import { Component, NgZone } from "@angular/core";

import * as clr from "../../stijl/colour";

import { MultiMetenOpties, MultiMetenUiSelector } from "../../kaart/meten/kaart-multi-meten.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-multi-meet-knop",
  template: ""
})
export class ClassicMultiMetenComponent extends ClassicUIElementSelectorComponentBase {
  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(MultiMetenUiSelector, kaart, zone);
    console.log("***multimetenknop starten");
  }

  protected opties(): MultiMetenOpties {
    console.log("***opties opvragen");
    return {
      markColour: clr.zwart // TODO lees van een Input
    };
  }
}
