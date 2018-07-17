import { Component, Input, NgZone } from "@angular/core";
import { none, Option } from "fp-ts/lib/Option";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

@Component({
  selector: "awv-kaart-info-boodschap-kaart-bevragen",
  templateUrl: "./kaart-info-boodschap-kaart-bevragen.component.html",
  styleUrls: ["./kaart-info-boodschap-kaart-bevragen.component.scss"]
})
export class KaartInfoBoodschapKaartBevragenComponent extends KaartChildComponentBase {
  @Input() coordinaat: Option<ol.Coordinate> = none;
  @Input() adres: Option<string> = none;
  @Input() weglocatie: Option<any> = none;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  coordinaatInformatie(): string {
    return this.coordinaat.map(coord => `${coord[0]} ${coord[1]}`).getOrElse("");
  }

  heeftAdres() {
    return this.adres.isSome();
  }

  heeftWegLocatie() {
    return this.weglocatie.isSome();
  }
}
