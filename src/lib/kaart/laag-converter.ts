import { KaartWithInfo } from "./kaart-with-info";
import * as array from "fp-ts/lib/Array";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { olx } from "openlayers";
import { kaartLogger } from "./log";
import * as ke from "./kaart-elementen";
import { WmtsCapaConfig } from "./kaart-elementen";

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

  function createdWmts(l: ke.WmtsLaag) {
    let source: ol.source.WMTS;
    if (l.config.type === "Capa") {
      const config = l.config as ke.WmtsCapaConfig;
      source = new ol.source.WMTS(config.wmtsOptions);
    } else {
      const config = l.config as ke.WmtsManualConfig;
      source = new ol.source.WMTS({
        projection: kaart.config.srs,
        urls: config.urls.toArray(),
        tileGrid: new ol.tilegrid.WMTS({
          origin: config.origin.toUndefined(),
          resolutions: kaart.config.defaults.resolutions,
          // extent: kaart.config.defaults.extent,
          matrixIds: config.matrixIds
        }),
        layer: l.naam,
        style: config.style.getOrElseValue(""),
        format: l.format.getOrElseValue("image/png"),
        matrixSet: l.matrixSet
      });
    }
    return new ol.layer.Tile(<ol.olx.layer.TileOptions>{
      title: l.titel,
      visible: true,
      extent: kaart.config.defaults.extent,
      opacity: l.opacity.toUndefined(),
      source: source
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

  type Stylish = ol.StyleFunction | ol.style.Style | ol.style.Style[];

  function determineStyle(vectorlaag: ke.VectorLaag, defaultStyle: ol.style.Style): Stylish {
    return vectorlaag.styleSelector
      .map(selector => (selector.type === "StaticStyle" ? selector.style : selector.styleFunction))
      .getOrElseValue(defaultStyle);
  }

  switch (laag.type) {
    case ke.TiledWmsType:
      return some(createdTileWms(laag as ke.WmsLaag));

    case ke.WmtsType:
      return some(createdWmts(laag as ke.WmtsLaag));

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
