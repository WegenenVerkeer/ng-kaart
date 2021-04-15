import { Component, Input, NgZone } from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";

import { matchGeometryType } from "../../util";
import { isObject } from "../../util/object";
import * as ol from "../../util/openlayers-compat";
import { KaartChildDirective } from "../kaart-child.directive";
import { InfoBoodschapIdentify } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import {
  Properties,
  VeldinfoMap,
} from "./kaart-info-boodschap-veldinfo.component";

const liftProperties: (f: ol.Feature) => Properties = (feature) => {
  const maybeOlProperties = option.fromNullable(feature.getProperties());
  const logicalProperties = pipe(
    maybeOlProperties,
    option.map((obj) => obj["properties"]),
    option.filter(isObject),
    option.getOrElse(() => ({}))
  );
  const geometryProperties = pipe(
    maybeOlProperties,
    option.map((obj) => obj["geometry"]),
    option.filter((obj) => obj instanceof ol.geom.Geometry),
    option.fold(
      () => ({}),
      (obj) => {
        const geometry = obj as ol.geom.Geometry;
        return {
          bbox: geometry.getExtent(),
          type: geometry.getType(),
          location: pipe(
            matchGeometryType(geometry, {
              point: (p) => p.getCoordinates(),
              circle: (p) => p.getCenter(),
              // Voor andere types kan ook op een of andere manier een locatie vooropgesteld worden,
              // maar overhead die practisch nooit nodig is
            }),
            option.toUndefined
          ),
          geometry,
        };
      }
    )
  );
  return {
    // geometry eerst zodat evt. geometry in logicalProperties voorrang heeft
    geometry: { ...geometryProperties },
    // en dan de "echte" properties
    ...logicalProperties,
  };
};

@Component({
  selector: "awv-kaart-info-boodschap-identify",
  templateUrl: "./kaart-info-boodschap-identify.component.html",
  styleUrls: ["./kaart-info-boodschap-identify.component.scss"],
})
export class KaartInfoBoodschapIdentifyComponent extends KaartChildDirective {
  properties: Properties;
  veldbeschrijvingen: VeldinfoMap = new Map();

  @Input()
  set boodschap(bsch: InfoBoodschapIdentify) {
    this.properties = liftProperties(bsch.feature);
    this.veldbeschrijvingen = pipe(
      bsch.laag,
      option.map((vectorlaag) => vectorlaag.velden),
      option.getOrElse(() => new Map())
    );
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }
}
