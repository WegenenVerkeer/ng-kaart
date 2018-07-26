import { Component, Input, NgZone } from "@angular/core";
import { fromNullable, none, Option } from "fp-ts/lib/Option";
import { List } from "immutable";

import { lambert72ToWgs84 } from "../../coordinaten/coordinaten.service";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { Adres, WegLocatie } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

@Component({
  selector: "awv-kaart-info-boodschap-kaart-bevragen",
  templateUrl: "./kaart-info-boodschap-kaart-bevragen.component.html",
  styleUrls: ["./kaart-info-boodschap-kaart-bevragen.component.scss"]
})
export class KaartInfoBoodschapKaartBevragenComponent extends KaartChildComponentBase {
  @Input() coordinaat: ol.Coordinate;
  @Input() adres: Option<Adres> = none;
  @Input() weglocaties: Option<List<WegLocatie>> = none;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  coordinaatInformatieLambert72(): string {
    return fromNullable(this.coordinaat)
      .map(coord => [coord[0].toFixed(0), coord[1].toFixed(0)])
      .map(coord => `${coord[0]}, ${coord[1]}`)
      .getOrElse("");
  }

  coordinaatInformatieWgs84(): string {
    return fromNullable(this.coordinaat)
      .map(coord => lambert72ToWgs84(coord))
      .map(coord => [coord[0].toFixed(7), coord[1].toFixed(7)])
      .map(coord => `${coord[0]}, ${coord[1]}`)
      .getOrElse("");
  }

  heeftAdres() {
    return this.adres.isSome();
  }

  getWegLocaties() {
    return this.weglocaties
      .getOrElse(List())
      .sortBy(locatie =>
        fromNullable(locatie)
          .map(loc => fromNullable(loc.ident8).getOrElse(""))
          .getOrElse("")
      )
      .toList();
  }

  getAdres(key: string): string {
    return this.adres.map(adres => adres[key]).getOrElse("");
  }

  signed(value: number): string {
    if (value >= 0) {
      return `+${value}`;
    } else {
      return `${value}`;
    }
  }
}
