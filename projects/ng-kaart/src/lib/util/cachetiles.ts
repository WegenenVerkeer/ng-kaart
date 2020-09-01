import { Function1, Function2, Function6 } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { mergeMap, tap } from "rxjs/operators";

import { kaartLogger } from "../kaart/log";

import { splitInChunks } from "./arrays";
import * as ol from "./openlayers-compat";

export interface Progress {
  readonly started: Date;
  readonly percentage: number;
}

const AANTAL_PARALLELE_REQUESTS = 4;

/**
 * Haalt alle urls op met AANTAL_PARALLELE_REQUESTS parallele requests door de url array in 6 chunks te verdelen en
 * deze parallel af te lopen.
 * Elke chunk gaat sequentieel 1 voor 1 elke URL ophalen.
 */
const fetchUrlsGrouped: Function1<string[], rx.Observable<Progress>> = (
  urls
) => {
  return new rx.Observable<Progress>((subscriber) => {
    let fetched = 0;
    const progress = {
      started: new Date(),
      percentage: 0,
    };

    const fetchUrls = (chunk: string[]) => {
      const fetches = chunk.map((url) => () => {
        fetched++;
        subscriber.next({
          ...progress,
          percentage: Math.floor((fetched / urls.length) * 100),
        });
        return fetch(new Request(url, { credentials: "include" }), {
          keepalive: true,
          mode: "cors",
        }).catch((err) => kaartLogger.error(err));
      });
      fetches.reduce(
        (vorige, huidige) => vorige.then(huidige),
        Promise.resolve()
      );
    };

    splitInChunks(urls, AANTAL_PARALLELE_REQUESTS).forEach((chunk) =>
      fetchUrls(chunk)
    );
  });
};

const deleteTiles: Function2<string, boolean, rx.Observable<boolean>> = (
  laagnaam,
  startMetLegeCache
) => (startMetLegeCache ? rx.from(caches.delete(laagnaam)) : rx.of(false));

export const refreshTiles: Function6<
  string,
  ol.source.UrlTile,
  number,
  number,
  string,
  boolean,
  rx.Observable<Progress>
> = (laagnaam, source, startZoom, stopZoom, wkt, startMetLegeCache) => {
  if (isNaN(startZoom)) {
    throw new Error("Start zoom is geen getal");
  }

  if (isNaN(stopZoom)) {
    throw new Error("Stop zoom is geen getal");
  }

  const sourceProjection = source.getProjection();
  const tileUrlFunction = source.getTileUrlFunction();
  const tileGrid = source.getTileGrid();

  const calculateTileRange = function (extent: ol.Extent, zoom: number) {
    const minTileCoord = tileGrid.getTileCoordForCoordAndZ(
      [extent[0], extent[1]],
      zoom
    );
    const maxTileCoord = tileGrid.getTileCoordForCoordAndZ(
      [extent[2], extent[3]],
      zoom
    );

    // we switchen hier minY en maxY vanwege verandering in OL6:
    // https://github.com/openlayers/openlayers/releases/tag/v6.0.0
    // New internal tile coordinates
    // Now, the internal tile coordinates used in the library have the same row order as standard (e.g. XYZ) tile coordinates.
    // The origin is at the top left (as before), and rows or y values increase downward. So the top left tile of a tile grid is
    // now 0, 0, whereas it was 0, -1 before
    const tileRangeMinX = minTileCoord[1];
    const tileRangeMaxY = minTileCoord[2];

    const tileRangeMaxX = maxTileCoord[1];
    const tileRangeMinY = maxTileCoord[2];

    return { tileRangeMinX, tileRangeMinY, tileRangeMaxX, tileRangeMaxY };
  };

  const geometry: ol.geom.Geometry | undefined = new ol.format.WKT()
    .readFeature(wkt, {
      dataProjection: sourceProjection,
      featureProjection: sourceProjection,
    })
    .getGeometry();

  let queue: string[] = [];
  const ignoreExtents: ol.Extent[] = [];
  for (let z = startZoom; z < stopZoom + 1; z++) {
    // Tilecoord: [z, x, y]

    const ignoreTileCoords = {};
    ignoreExtents.forEach((extent) => {
      const {
        tileRangeMinX,
        tileRangeMinY,
        tileRangeMaxX,
        tileRangeMaxY,
      } = calculateTileRange(extent, z);
      for (let x = tileRangeMinX; x <= tileRangeMaxX; x++) {
        for (let y = tileRangeMinY; y <= tileRangeMaxY; y++) {
          if (ignoreTileCoords[x] === undefined) {
            ignoreTileCoords[x] = {};
          }
          ignoreTileCoords[x][y] = true;
        }
      }
    });

    const queueByZ: string[] = [];
    if (geometry) {
      const geometryExtent = geometry.getExtent();

      const {
        tileRangeMinX,
        tileRangeMinY,
        tileRangeMaxX,
        tileRangeMaxY,
      } = calculateTileRange(geometryExtent, z);
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
            const middenCoord: [number, number] = [
              left + (right - left) / 2,
              bottom + (top - bottom) / 2,
            ];
            const middenBottom: [number, number] = [
              left + (right - left) / 2,
              bottom,
            ];
            const middenTop: [number, number] = [
              left + (right - left) / 2,
              top,
            ];
            const middenLeft: [number, number] = [
              left,
              bottom + (top - bottom) / 2,
            ];
            const middenRight: [number, number] = [
              right,
              bottom + (top - bottom) / 2,
            ];

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
              const tileUrl = tileUrlFunction(
                tileCoord,
                ol.has.DEVICE_PIXEL_RATIO,
                source.getProjection()
              );
              if (tileUrl) {
                queueByZ.push(tileUrl);
              }
            } else {
              ignoreExtents.push(coordinatesBbox);
            }
          }
        }
      }
    }

    kaartLogger.info(
      `Aantal tiles ${laagnaam} voor zoomniveau ${z}: ${queueByZ.length}`
    );
    queue = queue.concat(queueByZ);
  }

  return deleteTiles(laagnaam, startMetLegeCache).pipe(
    tap((cacheLeeggemaakt) =>
      cacheLeeggemaakt
        ? kaartLogger.info(`Cache ${laagnaam} leeggemaakt`)
        : kaartLogger.info(
            `Cache ${laagnaam} niet leeggemaakt, wordt verder gevuld`
          )
    ),
    mergeMap(() => fetchUrlsGrouped(queue))
  );
};
