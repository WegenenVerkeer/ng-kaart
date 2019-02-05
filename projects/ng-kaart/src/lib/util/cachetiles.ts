import { Function1 } from "fp-ts/lib/function";
import * as ol from "openlayers";
import * as url from "url";

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

const deleteTiles = (laagnaam: string, deleteCache: boolean): Promise<Boolean> =>
  deleteCache ? caches.delete(laagnaam) : Promise.resolve(true);

// TODO: dit is tijdelijke code -- functie wordt vervangen door performanter alternatief in latere story
export const refreshTiles = (
  laagnaam: string,
  source: ol.source.UrlTile,
  startZoom: number,
  stopZoom: number,
  wkt: string,
  deleteCache: boolean,
  setProgress: Function1<number, void> // callback om progress aan te geven
) => {
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
        const params = url.parse(tileUrl, true);
        const bbox = params.query["BBOX"] as string;
        if (bbox) {
          // left,bottom,right,top
          const coordinatesBbox = bbox.split(",");

          const left = Number(coordinatesBbox[0]);
          const bottom = Number(coordinatesBbox[1]);
          const right = Number(coordinatesBbox[2]);
          const top = Number(coordinatesBbox[3]);

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
          kaartLogger.error(`Geen bbox parameter in URL ${tileUrl}`);
        }
      }
    }

    kaartLogger.info(`Aantal tiles ${laagnaam} voor zoomniveau ${z}: ${queueByZ.length}`);
    queue = queue.concat(queueByZ);
  }

  deleteTiles(laagnaam, deleteCache).then(() => fetchUrls(queue, setProgress));
};
