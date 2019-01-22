import * as ol from "openlayers";
import * as url from "url";

import { kaartLogger } from "../kaart/log";

const decodeURLParams = search => {
  const hashes = search.slice(search.indexOf("?") + 1).split("&");
  return hashes.reduce((params, hash) => {
    const split = hash.indexOf("=");

    if (split < 0) {
      return Object.assign(params, {
        [hash]: null
      });
    }

    const key = hash.slice(0, split).toLowerCase();
    const val = hash.slice(split + 1);

    return Object.assign(params, { [key]: decodeURIComponent(val) });
  }, {});
};

const fetchUrls = (urls: string[]) => {
  const interval = 60; //  = 60 ms
  let timeout = interval;
  urls.forEach(url => {
    setTimeout(function() {
      fetch(new Request(url, { credentials: "include" }), { keepalive: true, mode: "cors" })
        .then(response => ({ response, cache: true }))
        .catch(err => kaartLogger.error(err));
    }, timeout);
    timeout += interval;
  });
};

const deleteTiles = (laagnaam: string): Promise<Boolean> => caches.delete(laagnaam);

// TODO: dit is tijdelijke code -- functie wordt vervangen door performanter alternatief in latere story
export const refreshTiles = (laagnaam: string, source: ol.source.UrlTile, startZoom: number, stopZoom: number, wkt: string) => {
  if (isNaN(startZoom)) {
    throw new Error("Start zoom is geen getal");
  }

  if (isNaN(stopZoom)) {
    throw new Error("Stop zoom is geen getal");
  }

  const geometry: ol.geom.Geometry = new ol.format.WKT()
    .readFeature(wkt, {
      dataProjection: source.getProjection(),
      featureProjection: source.getProjection()
    })
    .getGeometry();

  let queue = [];

  for (let z = startZoom; z < stopZoom + 1; z++) {
    // Tilecoord: [z, x, y]
    const minTileCoord = source.getTileGrid().getTileCoordForCoordAndZ([geometry.getExtent()[0], geometry.getExtent()[1]], z);
    const maxTileCoord = source.getTileGrid().getTileCoordForCoordAndZ([geometry.getExtent()[2], geometry.getExtent()[3]], z);

    const tileRangeMinX = minTileCoord[1];
    const tileRangeMinY = minTileCoord[2];

    const tileRangeMaxX = maxTileCoord[1];
    const tileRangeMaxY = maxTileCoord[2];

    const queueByZ = [];
    for (let x = tileRangeMinX; x <= tileRangeMaxX; x++) {
      for (let y = tileRangeMinY; y <= tileRangeMaxY; y++) {
        const tileCoord: [number, number, number] = [z, x, y];
        const tileUrl = source.getTileUrlFunction()(tileCoord, ol.has.DEVICE_PIXEL_RATIO, source.getProjection());
        const queryParams = url.parse(tileUrl).search;
        const bbox = decodeURLParams(queryParams)["bbox"];
        if (bbox) {
          // left,bottom,right,top
          const coordinatesBbox = bbox.split(",");

          const left = coordinatesBbox[0];
          const bottom = coordinatesBbox[1];
          const right = coordinatesBbox[2];
          const top = coordinatesBbox[3];

          const ltCoord: [number, number] = [left, top];
          const lbCoord: [number, number] = [left, bottom];
          const rtCoord: [number, number] = [right, top];
          const rbCoord: [number, number] = [right, bottom];

          if (
            geometry.intersectsCoordinate(ltCoord) ||
            geometry.intersectsCoordinate(lbCoord) ||
            geometry.intersectsCoordinate(rtCoord) ||
            geometry.intersectsCoordinate(rbCoord)
          ) {
            queueByZ.push(tileUrl);
          }
        } else {
          alert(`Geen bbox parameter in URL ${queryParams}`);
        }
      }
    }

    kaartLogger.info(`Aantal tiles ${laagnaam} voor zoomniveau ${z}: ${queueByZ.length}`);
    queue = queue.concat(queueByZ);
  }

  deleteTiles(laagnaam).then(() => fetchUrls(queue));
};
