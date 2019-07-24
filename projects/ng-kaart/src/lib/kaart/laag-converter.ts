import * as array from "fp-ts/lib/Array";
import { Function1 } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as set from "fp-ts/lib/Set";
import { setoidString } from "fp-ts/lib/Setoid";
import * as ol from "openlayers";
import { olx } from "openlayers";

import { Epsg } from "../coordinaten";

import * as ke from "./kaart-elementen";
import { KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";
import { toStylish } from "./stijl-selector";

export function toOlLayer(kaart: KaartWithInfo, laag: ke.Laag): Option<ol.layer.Base> {
  const supportedProjections = new Set(Epsg.all);

  const stringIntersector = set.intersection(setoidString);

  const first: Function1<Set<string>, Option<string>> = (set: Set<string>) => (set.size > 0 ? some(set.values().next().value) : none);

  const projection: Function1<string[], string> = projections =>
    first(stringIntersector(supportedProjections, new Set(projections))).getOrElse(kaart.config.srs);

  function createdTileWms(l: ke.WmsLaag) {
    return new ol.layer.Tile(<olx.layer.TileOptions>{
      title: l.titel,
      visible: true,
      extent: kaart.config.defaults.extent,
      source: new ol.source.TileWMS({
        projection: projection(l.beschikbareProjecties),
        cacheSize: kaart.tileLoader.maxMislukteTiles,
        urls: l.urls,
        tileGrid: ol.tilegrid.createXYZ({
          extent: kaart.config.defaults.extent,
          tileSize: l.tileSize.getOrElse(256)
        }),
        tileLoadFunction: kaart.tileLoader.tileLoadFunction,
        params: {
          LAYERS: l.naam,
          TILED: true,
          SRS: projection(l.beschikbareProjecties),
          VERSION: l.versie.getOrElse("1.3.0"),
          FORMAT: l.format.getOrElse("image/png"),
          ...l.cqlFilter.fold({}, cqlFilter => ({ CQL_FILTER: cqlFilter }))
        }
      })
    });
  }

  function createdWmts(l: ke.WmtsLaag) {
    let source: ol.source.WMTS;
    let extent: ol.Extent;
    if (l.config.type === "Capa") {
      const config = l.config as ke.WmtsCapaConfig;
      extent = kaart.config.defaults.extent;
      source = new ol.source.WMTS(config.wmtsOptions);
    } else {
      const config = l.config as ke.WmtsManualConfig;
      extent = config.extent.getOrElse(kaart.config.defaults.extent);
      source = new ol.source.WMTS({
        projection: kaart.config.srs,
        urls: config.urls,
        tileGrid: new ol.tilegrid.WMTS({
          origin: config.origin.getOrElseL(() => ol.extent.getTopLeft(extent)),
          resolutions: kaart.config.defaults.resolutions,
          matrixIds: config.matrixIds
        }),
        tileLoadFunction: kaart.tileLoader.tileLoadFunction,
        layer: l.naam,
        style: config.style.getOrElse(""),
        format: l.format.getOrElse("image/png"),
        matrixSet: l.matrixSet
      });
    }
    return new ol.layer.Tile(<ol.olx.layer.TileOptions>{
      title: l.titel,
      visible: true,
      extent: extent,
      source: source
    });
  }

  function createSingleTileWmsLayer(l: ke.WmsLaag) {
    return new ol.layer.Image({
      source: new ol.source.ImageWMS({
        url: l.urls[0],
        params: {
          LAYERS: l.naam,
          SRS: projection(l.beschikbareProjecties),
          VERSION: l.versie.getOrElse("1.3.0"),
          FORMAT: l.format.getOrElse("image/png")
        },
        projection: projection(l.beschikbareProjecties),
        ratio: 1.1,
        hidpi: false
      })
    });
  }

  function createVectorLayer(vectorlaag: ke.VectorLaag) {
    if (array.isOutOfBound(vectorlaag.minZoom - 1, kaart.config.defaults.resolutions)) {
      kaartLogger.error(`Ongeldige minZoom voor ${vectorlaag.titel}:
        ${vectorlaag.minZoom}, moet tussen 1 en ${kaart.config.defaults.resolutions.length} liggen`);
    }
    if (array.isOutOfBound(vectorlaag.maxZoom, kaart.config.defaults.resolutions)) {
      kaartLogger.error(`Ongeldige maxZoom voor ${vectorlaag.titel}:
        ${vectorlaag.maxZoom}, moet tussen 0 en ${kaart.config.defaults.resolutions.length - 1} liggen`);
    }

    /**
     * Er zijn standaard 16 zoomniveau's, van 0 tot 15. De overeenkomende resoluties zijn
     * [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125]
     *
     * minZoom bepaalt de maxResolution, maxZoom bepaalt de minResolution
     * maxResolution is exclusief dus bepaald door minZoom + een fractie bijgeteld
     * ("maximum resolution (exclusive) below which this layer will be visible")
     *
     * Bvb: voor een minZoom van 2 en een maxZoom van 4 willen we alle resoluties in de range 256.0 tem 64.0.
     *      dwz een maxResolution van 256.0 en minResolution van 64.0.
     *      Maar omdat maxResolution exclusief is, dienen we een fractie bij te tellen zodat deze inclusief wordt.
     *      We zetten de range op 256.0001 tot 64.0
     *
     */

    const vector = new ol.layer.Vector({
      source: vectorlaag.clusterDistance.foldL(
        () => vectorlaag.source,
        distance => new ol.source.Cluster({ source: vectorlaag.source, distance: distance })
      ),
      visible: true,
      style: vectorlaag.styleSelector.map(toStylish).getOrElse(kaart.config.defaults.style),
      minResolution: array
        .lookup(vectorlaag.maxZoom, kaart.config.defaults.resolutions)
        .getOrElse(kaart.config.defaults.resolutions[kaart.config.defaults.resolutions.length - 1]),
      maxResolution: array
        .lookup(vectorlaag.minZoom, kaart.config.defaults.resolutions)
        .map(maxResolutie => maxResolutie + 0.0001) // max is exclusive, dus tel een fractie bij zodat deze inclusief wordt
        .getOrElse(kaart.config.defaults.resolutions[0])
    });

    vector.set(ke.LayerProperties.Selecteerbaar, vectorlaag.selecteerbaar);
    vector.set(ke.LayerProperties.Hover, vectorlaag.hover);
    return vector;
  }

  function createBlankLayer() {
    return new ol.layer.Tile(); // Hoe eenvoudig kan het zijn?
  }

  switch (laag.type) {
    case ke.TiledWmsType:
      return some(createdTileWms(laag));

    case ke.WmtsType:
      return some(createdWmts(laag));

    case ke.SingleTileWmsType:
      return some(createSingleTileWmsLayer(laag));

    case ke.VectorType:
      return some(createVectorLayer(laag));

    case ke.BlancoType:
      return some(createBlankLayer());

    default:
      return none;
  }
}
