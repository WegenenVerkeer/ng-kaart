import { Component, Input, NgZone } from "@angular/core";
import { Function1 } from "fp-ts/lib/function";

import { copyToClipboard } from "../../util/clipboard";
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

const formatCoordinates: Function1<number[], string> = coords => {
  return coords.reduce((acc, coord, idx) => acc + (idx % 2 === 0 ? `${coord}` : `,${coord} `), "").trim();
};

@Component({
  selector: "awv-kaart-info-boodschap-meten",
  templateUrl: "./kaart-info-boodschap-meten.component.html",
  styleUrls: ["./kaart-info-boodschap-meten.component.scss"]
})
export class KaartInfoBoodschapMetenComponent extends KaartChildComponentBase {
  length?: string;
  area?: string;
  coordinates?: string;
  lengthCopyInfo?: string;
  areaCopyInfo?: string;
  coordinatesCopyInfo?: string;

  @Input()
  set boodschap(bsch: InfoBoodschapMeten) {
    this.length = bsch.length.map(formatLength).toUndefined();
    this.lengthCopyInfo = bsch.length.map(l => "" + l).toUndefined();
    this.area = bsch.area.map(formatArea).toUndefined();
    this.areaCopyInfo = bsch.area.map(a => "" + a).toUndefined();
    this.coordinates = bsch.coordinates.map(formatCoordinates).toUndefined();
    this.coordinatesCopyInfo = bsch.coordinates.map(formatCoordinates).toUndefined();
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  copyToClipboard(toCopy?: string) {
    if (toCopy) {
      copyToClipboard(toCopy);
    }
  }
}
