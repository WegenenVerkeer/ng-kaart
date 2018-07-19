import { Component, Input, NgZone } from "@angular/core";
import { none, Option } from "fp-ts/lib/Option";

import { lambert72ToWgs84 } from "../../coordinaten/coordinaten.service";
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

  coordinaatInformatieLambert72(): string {
    return this.coordinaat
      .map(coord => [coord[0].toFixed(0), coord[1].toFixed(0)])
      .map(coord => `${coord[0]}, ${coord[1]}`)
      .getOrElse("");
  }

  coordinaatInformatieWgs84(): string {
    return this.coordinaat
      .map(coord => lambert72ToWgs84(coord))
      .map(coord => [coord[0].toFixed(7), coord[1].toFixed(7)])
      .map(coord => `${coord[0]}, ${coord[1]}`)
      .getOrElse("");
  }

  heeftAdres() {
    return this.adres.isSome();
  }

  heeftWegLocatie() {
    return this.weglocatie.isSome();
  }
}
