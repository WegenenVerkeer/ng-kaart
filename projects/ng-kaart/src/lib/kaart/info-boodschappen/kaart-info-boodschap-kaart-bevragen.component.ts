import {
  ChangeDetectionStrategy,
  Component,
  Input,
  NgZone,
} from "@angular/core";
import { array, either, option, ord } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";

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
  LaagLocationInfo,
  LaagLocationInfoResult,
  PerceelInfo,
  TextLaagLocationInfo,
  VeldinfoLaagLocationInfo,
  Veldwaarde,
} from "../kaart-bevragen/laaginfo.model";
import { KaartChildDirective } from "../kaart-child.directive";
import { InfoBoodschapKaartBevragenProgress } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import {
  Properties,
  VeldinfoMap,
} from "./kaart-info-boodschap-veldinfo.component";

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
  (wl: WegLocatie) => wl.projectieafstand
)(ord.ordNumber);

const textLaagLocationInfoToLaagInfo: (
  arg1: string,
  arg2: TextLaagLocationInfo
) => LaagInfo = (titel, tlli) => ({
  titel: titel,
  busy: false,
  text: tlli.text,
});

const veldwaardenToProperties: (arg: Veldwaarde[]) => Properties = (
  veldwaarden
) =>
  veldwaarden.reduce((obj, waarde) => {
    obj[waarde[0]] = waarde[1];
    return obj;
  }, {});

const veldinfoLaagLocationInfoToLaagInfo: (
  arg1: string,
  arg2: VeldinfoLaagLocationInfo
) => LaagInfo = (titel, vlli) => ({
  titel: titel,
  busy: false,
  properties: veldwaardenToProperties(vlli.waarden),
  veldinfos: maps.toMapByKey(vlli.veldinfos, (vi) => vi.naam),
});

const errorToLaagInfo: (string) => (string) => LaagInfo = (titel) => (
  error
) => ({
  titel: titel,
  busy: false,
  timedout: false,
  text: error,
});

const laagLocationInfoResultToLaagInfo: (
  titel: string,
  llie: LaagLocationInfoResult
) => LaagInfo = (titel, llie) =>
  either.fold(
    errorToLaagInfo(titel), //
    (lli: LaagLocationInfo) =>
      lli.type === "TextLaagLocationInfo"
        ? textLaagLocationInfoToLaagInfo(titel, lli)
        : veldinfoLaagLocationInfoToLaagInfo(titel, lli)
  )(llie);

@Component({
  selector: "awv-kaart-info-boodschap-kaart-bevragen",
  templateUrl: "./kaart-info-boodschap-kaart-bevragen.component.html",
  styleUrls: ["./kaart-info-boodschap-kaart-bevragen.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KaartInfoBoodschapKaartBevragenComponent extends KaartChildDirective {
  laagInfos: LaagInfo[];
  coordinaatInformatieLambert72: string;
  coordinaatInformatieWgs84: string;
  wegLocaties: WegLocatie[];
  adressen: Adres[];
  perceel: PerceelInfo | undefined;

  @Input()
  set boodschap(boodschap: InfoBoodschapKaartBevragenProgress) {
    // Deze waarden voor de template worden berekend op het moment dat er een nieuwe input is, niet elke
    // keer dat Angular denkt dat hij change detection moet laten lopen.
    const foldF: (
      key: string,
      value: Progress<LaagLocationInfoResult>,
      acc: LaagInfo[]
    ) => LaagInfo[] = (key, value, acc) =>
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
    this.coordinaatInformatieLambert72 = pipe(
      option.fromNullable(boodschap.coordinaat),
      option.map(formatCoordinate(0)),
      option.getOrElse(() => "")
    );
    this.coordinaatInformatieWgs84 = pipe(
      option.fromNullable(boodschap.coordinaat),
      option.map(lambert72ToWgs84),
      option.map(switchVolgorde), // andere volgorde weergeven voor wgs84
      option.map(formatCoordinate(7)),
      option.getOrElse(() => "")
    );
    this.wegLocaties = array.sort(projectafstandOrd)(boodschap.weglocaties);

    this.adressen = option.fold(
      () => [],
      (adres: Adres) => [adres]
    )(boodschap.adres); // Array van 0 of 1 eltn isomorf met Option, maar makkelijker voor Angular
    this.perceel = option.toUndefined(boodschap.perceel);
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
