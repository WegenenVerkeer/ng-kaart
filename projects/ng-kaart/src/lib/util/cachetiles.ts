import { Function1 } from "fp-ts/lib/function";
import * as ol from "openlayers";

import { kaartLogger } from "../kaart/log";

const fetchUrls = (urls: string[], setProgress: Function1<number, void>) => {
  let fetched = 0;
  const fetches = urls.map(url => () => {
    fetched++;
    if (setProgress) {
      setProgress(Math.round((fetched / urls.length) * 100));
    }
    return fetch(new Request(url, { credentials: "include" }), { keepalive: true, mode: "cors" }).catch(err => kaartLogger.error(err));
  });
  fetches.reduce((vorige, huidige) => vorige.then(huidige), Promise.resolve());
};

const deleteTiles = (laagnaam: string, startMetLegeCache: boolean): Promise<Boolean> =>
  startMetLegeCache ? caches.delete(laagnaam) : Promise.resolve(false);

// TODO: dit is tijdelijke code -- functie wordt vervangen door performanter alternatief in latere story
export const refreshTiles = (
  laagnaam: string,
  source: ol.source.UrlTile,
  startZoom: number,
  stopZoom: number,
  wkt: string,
  startMetLegeCache: boolean,
  setProgress: Function1<number, void> // callback om progress aan te geven
) => {
  if (isNaN(startZoom)) {
    throw new Error("Start zoom is geen getal");
  }

  if (isNaN(stopZoom)) {
    throw new Error("Stop zoom is geen getal");
  }

  const sourceProjection = source.getProjection();
  const tileUrlFunction = source.getTileUrlFunction();
  const tileGrid = source.getTileGrid();

  const calculateTileRange = function(extent, zoom) {
    const minTileCoord = tileGrid.getTileCoordForCoordAndZ([extent[0], extent[1]], zoom);
    const maxTileCoord = tileGrid.getTileCoordForCoordAndZ([extent[2], extent[3]], zoom);

    const tileRangeMinX = minTileCoord[1];
    const tileRangeMinY = minTileCoord[2];

    const tileRangeMaxX = maxTileCoord[1];
    const tileRangeMaxY = maxTileCoord[2];

    return { tileRangeMinX, tileRangeMinY, tileRangeMaxX, tileRangeMaxY };
  };

  const geometry: ol.geom.Geometry = new ol.format.WKT()
    .readFeature(wkt, {
      dataProjection: sourceProjection,
      featureProjection: sourceProjection
    })
    .getGeometry();

  const geometryExtent = geometry.getExtent();

  let queue = [];
  const ignoreExtents = [];
  for (let z = startZoom; z < stopZoom + 1; z++) {
    // Tilecoord: [z, x, y]

    const ignoreTileCoords = {};
    ignoreExtents.forEach(extent => {
      const { tileRangeMinX, tileRangeMinY, tileRangeMaxX, tileRangeMaxY } = calculateTileRange(extent, z);
      for (let x = tileRangeMinX; x <= tileRangeMaxX; x++) {
        for (let y = tileRangeMinY; y <= tileRangeMaxY; y++) {
          if (ignoreTileCoords[x] === undefined) {
            ignoreTileCoords[x] = {};
          }
          ignoreTileCoords[x][y] = true;
        }
      }
    });

    const queueByZ = [];
    const { tileRangeMinX, tileRangeMinY, tileRangeMaxX, tileRangeMaxY } = calculateTileRange(geometryExtent, z);
    for (let x = tileRangeMinX; x <= tileRangeMaxX; x++) {
      for (let y = tileRangeMinY; y <= tileRangeMaxY; y++) {
        if (ignoreTileCoords[x] && ignoreTileCoords[x][y]) {
          // deze tile valt buiten de geometrie
        } else {
          const tileCoord: [number, number, number] = [z, x, y];
          // left,bottom,right,top
          const coordinatesBbox = tileGrid.getTileCoordExtent(tileCoord);

          const left = coordinatesBbox[0];
          const bottom = coordinatesBbox[1];
          const right = coordinatesBbox[2];
          const top = coordinatesBbox[3];

          const ltCoord: [number, number] = [left, top];
          const lbCoord: [number, number] = [left, bottom];
          const rtCoord: [number, number] = [right, top];
          const rbCoord: [number, number] = [right, bottom];
          const middenCoord: [number, number] = [left + (right - left) / 2, bottom + (top - bottom) / 2];
          const middenBottom: [number, number] = [left + (right - left) / 2, bottom];
          const middenTop: [number, number] = [left + (right - left) / 2, top];
          const middenLeft: [number, number] = [left, bottom + (top - bottom) / 2];
          const middenRight: [number, number] = [right, bottom + (top - bottom) / 2];

          // snelle check of de geometrie overlapt met een aantal punten van de extent
          // geeft false negative als de geometrie overlapt met de tile, maar met geen van de getestte punten
          let intersects =
            geometry.intersectsCoordinate(middenCoord) ||
            geometry.intersectsCoordinate(ltCoord) ||
            geometry.intersectsCoordinate(lbCoord) ||
            geometry.intersectsCoordinate(rtCoord) ||
            geometry.intersectsCoordinate(rbCoord) ||
            geometry.intersectsCoordinate(middenBottom) ||
            geometry.intersectsCoordinate(middenTop) ||
            geometry.intersectsCoordinate(middenLeft) ||
            geometry.intersectsCoordinate(middenRight);

          // t.e.m. zoomniveau 12 gaan we voor zekerheid
          if (!intersects && z <= 12) {
            // correcter, maar (+-30x) trager
            intersects = geometry["intersectsExtent"](coordinatesBbox);
          }

          if (intersects) {
            const tileUrl = tileUrlFunction(tileCoord, ol.has.DEVICE_PIXEL_RATIO, source.getProjection());
            queueByZ.push(tileUrl);
          } else {
            ignoreExtents.push(coordinatesBbox);
          }
        }
      }
    }

    kaartLogger.info(`Aantal tiles ${laagnaam} voor zoomniveau ${z}: ${queueByZ.length}`);
    queue = queue.concat(queueByZ);
  }

  deleteTiles(laagnaam, startMetLegeCache).then(cacheLeeggemaakt => {
    cacheLeeggemaakt
      ? kaartLogger.info(`Cache ${laagnaam} leeggemaakt`)
      : kaartLogger.info(`Cache ${laagnaam} niet leeggemaakt, wordt verder gevuld`);
    return fetchUrls(queue, setProgress);
  });
};
