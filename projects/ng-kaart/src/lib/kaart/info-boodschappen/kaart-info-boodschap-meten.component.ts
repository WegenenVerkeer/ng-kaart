import { Component, Input, NgZone } from "@angular/core";
import { Function1, Function2 } from "fp-ts/lib/function";

import { eqCoordinate } from "../../util";
import { InfoBoodschapMeten } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";
import { KaartInfoBoodschapBaseDirective } from "./kaart-info-boodschap-base.component";

const formatNumber: Function1<number, string> = (n) =>
  n.toLocaleString(["nl-BE"], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

const formatArea: Function1<number, string> = (area) => {
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

const formatLength: Function1<number, string> = (length) => {
  if (length > 1000) {
    return `${formatNumber(length / 1000)} km`;
  } else {
    return `${formatNumber(length)} m`;
  }
};

// Coordinaten voor multilines bevatten duplicates voor de eind waarde van de vorige lijn en begin van de volgende. Die zijn niet
// relevant voor de gebruiker, dus filteren we ze weg.
const removeDuplicates: Function1<number[], number[]> = (coordinates) =>
  coordinates.reduce((acc, coord, idx, coords) => {
    // enkel x values als start bekijken
    if (idx % 2 === 0) {
      // check of huidige coordinaat dezelfde is als de vorige
      if (
        idx > 1 &&
        eqCoordinate.equals(
          [coords[idx - 2], coords[idx - 1]],
          [coords[idx], coords[idx + 1]]
        )
      ) {
        return acc;
      } else {
        return acc.concat([coords[idx], coords[idx + 1]]);
      }
    } else {
      return acc;
    }
  }, [] as number[]);

const formatCoordinates: Function2<number[], boolean, string> = (
  coords,
  delimiter
) =>
  coords //
    .reduce(
      (acc, coord, idx) =>
        acc +
        (idx % 2 === 0
          ? `${Math.round(coord)}`
          : `,${Math.round(coord)}${delimiter ? ";" : ""} `),
      ""
    )
    .trim();

@Component({
  selector: "awv-kaart-info-boodschap-meten",
  templateUrl: "./kaart-info-boodschap-meten.component.html",
  styleUrls: ["./kaart-info-boodschap-meten.component.scss"],
})
export class KaartInfoBoodschapMetenComponent extends KaartInfoBoodschapBaseDirective<
  InfoBoodschapMeten
> {
  length?: string;
  area?: string;
  coordinates?: string;
  lengthCopyInfo?: string;
  areaCopyInfo?: string;
  coordinatesCopyInfo?: string;

  @Input()
  set boodschap(bsch: InfoBoodschapMeten) {
    super.boodschap = bsch;
    this.length = bsch.length.map(formatLength).toUndefined();
    this.lengthCopyInfo = bsch.length.map((l) => "" + l).toUndefined();
    this.area = bsch.area.map(formatArea).toUndefined();
    this.areaCopyInfo = bsch.area.map((a) => "" + a).toUndefined();
    this.coordinates = bsch.coordinates
      .map((c) => formatCoordinates(removeDuplicates(c), false))
      .toUndefined();
    this.coordinatesCopyInfo = bsch.coordinates
      .map((c) => formatCoordinates(removeDuplicates(c), true))
      .toUndefined();
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }
}
