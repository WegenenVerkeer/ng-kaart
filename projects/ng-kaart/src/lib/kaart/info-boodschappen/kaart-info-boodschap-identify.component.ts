import { Component, Input, NgZone } from "@angular/core";
import { option } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";

import { matchGeometryType } from "../../util";
import { isObject } from "../../util/object";
import * as ol from "../../util/openlayers-compat";
import { KaartChildDirective } from "../kaart-child.directive";
import { InfoBoodschapIdentify } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import { Properties, VeldinfoMap } from "./kaart-info-boodschap-veldinfo.component";

const liftProperties: Function1<ol.Feature, Properties> = feature => {
  const maybeOlProperties = option.fromNullable(feature.getProperties());
  const logicalProperties = maybeOlProperties
    .map(obj => obj["properties"])
    .filter(isObject)
    .getOrElse({});
  const geometryProperties = maybeOlProperties
    .map(obj => obj["geometry"])
    .filter(obj => obj instanceof ol.geom.Geometry)
    .fold<Properties>({}, obj => {
      const geometry = obj as ol.geom.Geometry;
      return {
        bbox: geometry.getExtent(),
        type: geometry.getType(),
        location: matchGeometryType(geometry, {
          point: p => p.getCoordinates(),
          circle: p => p.getCenter()
          // Voor andere types kan ook op een of andere manier een locatie vooropgesteld worden, maar overhead die practisch nooit nodig is
        }).toUndefined(),
        geometry
      };
    });
  return {
    // geometry eerst zodat evt. geometry in logicalProperties voorrang heeft
    geometry: { ...geometryProperties },
    // en dan de "echte" properties
    ...logicalProperties
  };
};

@Component({
  selector: "awv-kaart-info-boodschap-identify",
  templateUrl: "./kaart-info-boodschap-identify.component.html"
})
export class KaartInfoBoodschapIdentifyComponent extends KaartChildDirective {
  properties: Properties;
  veldbeschrijvingen: VeldinfoMap = new Map();

  @Input()
  set boodschap(bsch: InfoBoodschapIdentify) {
    this.properties = liftProperties(bsch.feature);
    this.veldbeschrijvingen = bsch.laag.map(vectorlaag => vectorlaag.velden).getOrElse(new Map());
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }
}
