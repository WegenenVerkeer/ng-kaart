import { ChangeDetectionStrategy, Component, Input, NgZone } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";

import { formatCoordinate, lambert72ToWgs84 } from "../../coordinaten/coordinaten.service";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { Adres, InfoBoodschapKaartBevragen, WegLocatie } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

export interface LaagInfo {
  titel: string;
  text: string;
}

@Component({
  selector: "awv-kaart-info-boodschap-kaart-bevragen",
  templateUrl: "./kaart-info-boodschap-kaart-bevragen.component.html",
  styleUrls: ["./kaart-info-boodschap-kaart-bevragen.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KaartInfoBoodschapKaartBevragenComponent extends KaartChildComponentBase {
  textLaagLocationInfo: Array<LaagInfo>;
  coordinaatInformatieLambert72: string;
  coordinaatInformatieWgs84: string;
  wegLocaties: Array<WegLocatie>;
  adressen: Array<Adres>;

  @Input()
  set boodschap(boodschap: InfoBoodschapKaartBevragen) {
    // Deze waarden voor de template worden berekend op het moment dat er een nieuwe input is, niet elke
    // keer dat Angular denkt dat hij change detection moet laten lopen.
    this.textLaagLocationInfo = boodschap.laagLocatieInfoOpTitel
      .filter(info => info!.type === "TextLaagLocationInfo") // Het enige dat we op dit moment ondersteunen
      .map((value, key) => ({ titel: key!, text: value!.text }))
      .toArray();
    this.coordinaatInformatieLambert72 = fromNullable(boodschap.coordinaat)
      .map(formatCoordinate(0))
      .getOrElse("");
    this.coordinaatInformatieWgs84 = fromNullable(boodschap.coordinaat)
      .map(lambert72ToWgs84)
      .map(formatCoordinate(7))
      .getOrElse("");
    this.wegLocaties = boodschap.weglocaties
      .sortBy(locatie =>
        fromNullable(locatie)
          .chain(loc => fromNullable(loc.ident8))
          .getOrElse("")
      )
      .toArray();
    this.adressen = boodschap.adres.fold([], adres => [adres]); // Array van 0 of 1 eltn isomorf met Option, maar makkelijker voor Angular
  }

  constructor(kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);
  }

  signed(value: number): string {
    if (value >= 0) {
      return `+${value}`;
    } else {
      return `${value}`;
    }
  }
}
