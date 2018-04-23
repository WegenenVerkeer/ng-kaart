import { KaartWithInfo } from "./kaart-with-info";
import * as array from "fp-ts/lib/Array";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { olx } from "openlayers";
import { kaartLogger } from "./log";
import * as ke from "./kaart-elementen";

export function toOlLayer(kaart: KaartWithInfo, laag: ke.Laag): Option<ol.layer.Base> {
  function createdTileWms(l: ke.WmsLaag) {
    return new ol.layer.Tile(<olx.layer.TileOptions>{
      title: l.titel,
      visible: true,
      extent: kaart.config.defaults.extent,
      opacity: l.opacity.toUndefined(),
      source: new ol.source.TileWMS({
        projection: undefined,
        urls: l.urls.toArray(),
        tileGrid: ol.tilegrid.createXYZ({
          extent: kaart.config.defaults.extent,
          tileSize: l.tileSize.getOrElseValue(256)
        }),
        params: {
          LAYERS: l.naam,
          TILED: true,
          SRS: kaart.config.srs,
          VERSION: l.versie.getOrElseValue("1.3.0"),
          FORMAT: l.format.getOrElseValue("image/png")
        }
      })
    });
  }

  function createSingleTileWmsLayer(l: ke.WmsLaag) {
    return new ol.layer.Image({
      opacity: l.opacity.toUndefined(),
      source: new ol.source.ImageWMS({
        url: l.urls.first(),
        params: {
          LAYERS: l.naam,
          SRS: kaart.config.srs,
          VERSION: l.versie.getOrElseValue("1.3.0"),
          FORMAT: l.format.getOrElseValue("image/png")
        },
        projection: kaart.config.srs
      })
    });
  }

  function createVectorLayer(vectorlaag: ke.VectorLaag) {
    if (array.isOutOfBound(vectorlaag.minZoom)(kaart.config.defaults.resolutions)) {
      kaartLogger.error(`Ongeldige minZoom voor ${vectorlaag.titel}:
        ${vectorlaag.minZoom}, moet tussen 0 en ${kaart.config.defaults.resolutions.length - 1} liggen`);
    }
    if (array.isOutOfBound(vectorlaag.maxZoom)(kaart.config.defaults.resolutions)) {
      kaartLogger.error(`Ongeldige maxZoom voor ${vectorlaag.titel}:
        ${vectorlaag.maxZoom}, moet tussen 0 en ${kaart.config.defaults.resolutions.length - 1} liggen`);
    }

    /**
     * Er zijn standaard 16 zoomniveau's, van 0 tot 15. De overeenkomende resoluties zijn
     * [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125]
     *
     * minZoom bepaalt de maxResolution, maxZoom bepaalt de minResolution
     * maxResolution is exclusief dus bepaalt door minZoom - 1 ("maximum resolution (exclusive) below which this layer will be visible")
     *
     */
    return new ol.layer.Vector({
      source: vectorlaag.source,
      visible: true,
      style: determineStyle(vectorlaag, kaart.config.defaults.style),
      minResolution: array
        .index(vectorlaag.maxZoom)(kaart.config.defaults.resolutions)
        .getOrElseValue(kaart.config.defaults.resolutions[kaart.config.defaults.resolutions.length - 1]),
      maxResolution: array
        .index(vectorlaag.minZoom - 1)(kaart.config.defaults.resolutions)
        .getOrElseValue(kaart.config.defaults.resolutions[0])
    });
  }

  function createBlankLayer() {
    return new ol.layer.Tile(); // Hoe eenvoudig kan het zijn?
  }

  function determineStyle(vectorlaag: ke.VectorLaag, defaultStyle: ol.style.Style): Stylish {
    return vectorlaag.styleSelector
      .map(selector => {
        switch (selector.type) {
          case "StaticStyle":
            return selector.style;
          case "DynamicStyle":
            return selector.styleFunction;
          case "Styles":
            return selector.styles;
        }
      })
      .getOrElseValue(defaultStyle);
  }

  switch (laag.type) {
    case ke.TiledWmsType:
      return some(createdTileWms(laag as ke.WmsLaag));

    case ke.SingleTileWmsType:
      return some(createSingleTileWmsLayer(laag as ke.WmsLaag));

    case ke.VectorType:
      return some(createVectorLayer(laag as ke.VectorLaag));

    case ke.BlancoType:
      return some(createBlankLayer());

    default:
      return none;
  }
}

export type Stylish = ol.StyleFunction | ol.style.Style | ol.style.Style[];

export function determineStyleSelector(stp?: Stylish): Option<ke.StyleSelector> {
  if (stp instanceof ol.style.Style) {
    return some(ke.StaticStyle(stp));
  } else if (typeof stp === "function") {
    return some(ke.DynamicStyle(stp as ol.StyleFunction));
  } else if (Array.isArray(stp)) {
    return some(ke.Styles(stp as ol.style.Style[]));
  } else {
    return none;
  }
}
