import { ChangeDetectionStrategy, Component, Input, NgZone } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { Function3 } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";
import * as ord from "fp-ts/lib/Ord";

import { Adres, WegLocatie } from "..";
import { formatCoordinate, lambert72ToWgs84, switchVolgorde } from "../../coordinaten/coordinaten.service";
import { copyToClipboard } from "../../util/clipboard";
import * as maps from "../../util/maps";
import { LaagLocationInfo } from "../kaart-bevragen/laaginfo.model";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { InfoBoodschapKaartBevragenProgress, Progress, withProgress } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

export interface LaagInfo {
  titel: string;
  busy?: boolean;
  timedout?: boolean;
  text?: string;
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
  set boodschap(boodschap: InfoBoodschapKaartBevragenProgress) {
    // Deze waarden voor de template worden berekend op het moment dat er een nieuwe input is, niet elke
    // keer dat Angular denkt dat hij change detection moet laten lopen.
    const foldF: Function3<string, Progress<LaagLocationInfo>, Array<LaagInfo>, Array<LaagInfo>> = (key, value, acc) =>
      acc.concat([
        withProgress(value!)(
          () => ({ titel: key!, busy: true }),
          () => ({ titel: key!, busy: false, timedout: true }),
          laaglocationinfo => ({ titel: key!, busy: false, text: laaglocationinfo.text })
        )
      ]);
    this.textLaagLocationInfo = maps.fold(boodschap.laagLocatieInfoOpTitel)(foldF)([]);
    this.coordinaatInformatieLambert72 = fromNullable(boodschap.coordinaat)
      .map(formatCoordinate(0))
      .getOrElse("");
    this.coordinaatInformatieWgs84 = fromNullable(boodschap.coordinaat)
      .map(lambert72ToWgs84)
      .map(switchVolgorde) // andere volgorde weergeven voor wgs84
      .map(formatCoordinate(7))
      .getOrElse("");

    const ordWeglocatie: ord.Ord<WegLocatie> = ord.contramap(
      locatie =>
        fromNullable(locatie)
          .chain(loc => fromNullable(loc.projectieafstand))
          .getOrElse(0),
      ord.ordNumber
    );
    this.wegLocaties = array.sort(ordWeglocatie)(boodschap.weglocaties);
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

  copyToClipboard(toCopy: string) {
    copyToClipboard(toCopy);
  }
}
