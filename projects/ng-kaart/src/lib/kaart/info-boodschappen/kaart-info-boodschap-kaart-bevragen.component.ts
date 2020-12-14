import {
  ChangeDetectionStrategy,
  Component,
  Input,
  NgZone,
} from "@angular/core";
import { array, option, ord } from "fp-ts";
import { Curried2, Function1, Function2, Function3 } from "fp-ts/lib/function";

import { Adres, WegLocatie } from "..";
import {
  formatCoordinate,
  lambert72ToWgs84,
  switchVolgorde,
} from "../../coordinaten/coordinaten.service";
import { copyToClipboard } from "../../util/clipboard";
import * as maps from "../../util/maps";
import { Progress, withProgress } from "../../util/progress";
import {
  LaagLocationInfoResult,
  PerceelInfo,
  TextLaagLocationInfo,
  VeldinfoLaagLocationInfo,
  Veldwaarde,
} from "../kaart-bevragen/laaginfo.model";
import { InfoBoodschapKaartBevragenProgress } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import {
  Properties,
  VeldinfoMap,
} from "./kaart-info-boodschap-veldinfo.component";
import { KaartInfoBoodschapBaseDirective } from "./kaart-info-boodschap-base.component";

// Een type om te gebruiken in de template. Makkelijkst met enkel native types.
export interface LaagInfo {
  titel: string;
  busy?: boolean;
  timedout?: boolean;
  text?: string;
  properties?: Properties;
  veldinfos?: VeldinfoMap;
}

const projectafstandOrd: ord.Ord<WegLocatie> = ord.contramap(
  (wl) => wl.projectieafstand,
  ord.ordNumber
);

const textLaagLocationInfoToLaagInfo: Function2<
  string,
  TextLaagLocationInfo,
  LaagInfo
> = (titel, tlli) => ({
  titel: titel,
  busy: false,
  text: tlli.text,
});

const veldwaardenToProperties: Function1<Veldwaarde[], Properties> = (
  veldwaarden
) =>
  veldwaarden.reduce((obj, waarde) => {
    obj[waarde[0]] = waarde[1];
    return obj;
  }, {});

const veldinfoLaagLocationInfoToLaagInfo: Function2<
  string,
  VeldinfoLaagLocationInfo,
  LaagInfo
> = (titel, vlli) => ({
  titel: titel,
  busy: false,
  properties: veldwaardenToProperties(vlli.waarden),
  veldinfos: maps.toMapByKey(vlli.veldinfos, (vi) => vi.naam),
});

const errorToLaagInfo: Curried2<string, string, LaagInfo> = (titel) => (
  error
) => ({
  titel: titel,
  busy: false,
  timedout: false,
  text: error,
});

const laagLocationInfoResultToLaagInfo: Function2<
  string,
  LaagLocationInfoResult,
  LaagInfo
> = (titel, llie) =>
  llie.fold(
    errorToLaagInfo(titel), //
    (lli) =>
      lli.type === "TextLaagLocationInfo"
        ? textLaagLocationInfoToLaagInfo(titel, lli)
        : veldinfoLaagLocationInfoToLaagInfo(titel, lli)
  );

@Component({
  selector: "awv-kaart-info-boodschap-kaart-bevragen",
  templateUrl: "./kaart-info-boodschap-kaart-bevragen.component.html",
  styleUrls: ["./kaart-info-boodschap-kaart-bevragen.component.scss"],
})
export class KaartInfoBoodschapKaartBevragenComponent extends KaartInfoBoodschapBaseDirective<
  InfoBoodschapKaartBevragenProgress
> {
  laagInfos: LaagInfo[];
  coordinaatInformatieLambert72: string;
  coordinaatInformatieWgs84: string;
  wegLocaties: WegLocatie[];
  adressen: Adres[];
  perceel: PerceelInfo | undefined;

  @Input()
  set boodschap(boodschap: InfoBoodschapKaartBevragenProgress) {
    super.boodschap = boodschap;
    // Deze waarden voor de template worden berekend op het moment dat er een nieuwe input is, niet elke
    // keer dat Angular denkt dat hij change detection moet laten lopen.
    const foldF: Function3<
      string,
      Progress<LaagLocationInfoResult>,
      LaagInfo[],
      LaagInfo[]
    > = (key, value, acc) =>
      array.snoc(
        acc,
        withProgress<LaagLocationInfoResult, LaagInfo>(
          () => ({ titel: key, busy: true }),
          () => ({ titel: key, busy: false, timedout: true }),
          (laaglocationinfo) =>
            laagLocationInfoResultToLaagInfo(key, laaglocationinfo)
        )(value)
      );
    this.laagInfos = maps.fold(boodschap.laagLocatieInfoOpTitel)(foldF)([]);
    this.coordinaatInformatieLambert72 = option
      .fromNullable(boodschap.coordinaat)
      .map(formatCoordinate(0))
      .getOrElse("");
    this.coordinaatInformatieWgs84 = option
      .fromNullable(boodschap.coordinaat)
      .map(lambert72ToWgs84)
      .map(switchVolgorde) // andere volgorde weergeven voor wgs84
      .map(formatCoordinate(5))
      .getOrElse("");
    this.wegLocaties = array.sort(projectafstandOrd)(boodschap.weglocaties);

    this.adressen = boodschap.adres.fold([], (adres) => [adres]); // Array van 0 of 1 eltn isomorf met Option, maar makkelijker voor Angular
    this.perceel = boodschap.perceel.toUndefined();
  }

  constructor(kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);
  }

  heeftWaarden(properties: Properties): boolean {
    return Object.keys(properties).length > 0;
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
