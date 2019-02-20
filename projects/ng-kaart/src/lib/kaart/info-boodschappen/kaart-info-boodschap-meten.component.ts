import { Component, Input, NgZone } from "@angular/core";
import { Function1 } from "fp-ts/lib/function";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { InfoBoodschapMeten } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

const formatNumber: Function1<number, string> = n =>
  n.toLocaleString(["nl-BE"], { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

const formatArea: Function1<number, string> = area => {
  if (area > 1000000) {
    return `${formatNumber(area / 1000000)} km²`;
  } else if (area > 10000) {
    return `${formatNumber(area / 10000)} ha`;
  } else if (area > 100) {
    return `${formatNumber(area / 100)} a`;
  } else {
    return `${formatNumber(area)} m²`;
  }
};

const formatLength: Function1<number, string> = length => {
  if (length > 1000) {
    return `${formatNumber(length / 1000)} km`;
  } else {
    return `${formatNumber(length)} m`;
  }
};

@Component({
  selector: "awv-kaart-info-boodschap-meten",
  templateUrl: "./kaart-info-boodschap-meten.component.html",
  styleUrls: ["./kaart-info-boodschap-meten.component.scss"]
})
export class KaartInfoBoodschapMetenComponent extends KaartChildComponentBase {
  protected length?: string;
  protected area?: string;
  protected lengthCopyInfo?: string;
  protected areaCopyInfo?: string;

  @Input()
  set boodschap(bsch: InfoBoodschapMeten) {
    this.length = bsch.length.map(formatLength).toUndefined();
    this.lengthCopyInfo = bsch.length.map(l => "" + l).toUndefined();
    this.area = bsch.area.map(formatArea).toUndefined();
    this.areaCopyInfo = bsch.area.map(a => "" + a).toUndefined();
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  copyToClipboard(toCopy: string) {
    const elem = document.createElement("textarea");
    elem.value = toCopy;
    document.body.appendChild(elem);
    elem.select();
    document.execCommand("copy");
    document.body.removeChild(elem);
  }
}
