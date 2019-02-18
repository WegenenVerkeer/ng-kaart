import { Component, Input, NgZone } from "@angular/core";

import * as clr from "../../stijl/colour";

import { MultiMetenOpties, MultiMetenUiSelector } from "../../kaart/meten/kaart-multi-meten.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-multi-meet-knop",
  template: ""
})
export class ClassicMultiMetenComponent extends ClassicUIElementSelectorComponentBase {
  @Input() // Dit moet dus effectief een code zijn in het formaat #rrggbb(tt?). De string 'white' bijv. is niet ok.
  tekenKleurCode = clr.kleurcodeValue(clr.zwartig);

  @Input()
  metRouting = false;

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(MultiMetenUiSelector, kaart, zone);
  }

  protected opties(): MultiMetenOpties {
    return {
      markColour: clr.toKleur("naam", this.tekenKleurCode).getOrElse(clr.zwartig),
      useRouting: this.metRouting,
      toonInfoBoodschap: true
    };
  }
}
