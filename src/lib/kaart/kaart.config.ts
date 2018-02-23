import { InjectionToken } from "@angular/core";
import * as ol from "openlayers";

export const KAART_CFG = new InjectionToken<KaartConfig>("kaartcfg");

export interface KaartConfig {
  readonly tilecache: {
    readonly urls: string[];
  };
  readonly geoserver: {
    readonly urls: string[];
  };
  readonly orthofotomozaiek: {
    readonly naam: string;
    readonly urls: string[];
  };
  readonly srs: string;

  readonly defaults: {
    zoom: number;
    middelpunt: ol.Coordinate;
    grootte: [number | undefined, number | undefined];
    resolutions: [number];
    extent: ol.Extent;
    style: ol.style.Style;
  };
}

const stdStijl = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "#5555FF40"
  }),
  stroke: new ol.style.Stroke({
    color: "darkslateblue ",
    width: 4
  }),
  image: new ol.style.Circle({
    fill: new ol.style.Fill({
      color: "maroon"
    }),
    stroke: new ol.style.Stroke({
      color: "gray",
      width: 1.25
    }),
    radius: 5
  })
});

export const defaultKaartConfig: KaartConfig = {
  geoserver: {
    urls: [
      "https://wms1.apps.mow.vlaanderen.be/geoserver/service/wms",
      "https://wms2.apps.mow.vlaanderen.be/geoserver/service/wms",
      "https://wms3.apps.mow.vlaanderen.be/geoserver/service/wms"
    ]
  },
  tilecache: {
    urls: [
      "https://wms1.apps.mow.vlaanderen.be/geowebcache/service/wms",
      "https://wms2.apps.mow.vlaanderen.be/geowebcache/service/wms",
      "https://wms3.apps.mow.vlaanderen.be/geowebcache/service/wms"
    ]
  },
  orthofotomozaiek: {
    naam: "Ortho",
    urls: ["http://geoservices.informatievlaanderen.be/raadpleegdiensten/omwrgbmrvl/wms"]
  },
  srs: "EPSG:31370",
  defaults: {
    zoom: 2,
    middelpunt: [130000, 193000],
    grootte: [undefined, 500],
    resolutions: [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125],
    extent: [18000.0, 152999.75, 280144.0, 415143.75],
    style: stdStijl
  }
};
