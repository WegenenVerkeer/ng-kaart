import * as ol from "openlayers";
import * as option from "fp-ts/lib/Option";
import { Option } from "fp-ts/lib/Option";
import { kaartLogger } from "../kaart/log";

/**
 * Gegeven een StyleFunction zonder offset rendering, geef er 1 terug waarbij de features op een offset gerendered worden.
 *
 * @param ol.StyleFunction styleFunction Oorspronkelijke stijl functie
 * @param string ident8Veld Plaats waar het ident8 veld te vinden is onder feature.properties
 * @param string zijderijbaanVeld Plaats waar de kant van de weg van het feature te vinden is onder feature.properties ('R', 'L', 'M'/'O')
 * @param number offsetPixels Aantal pixels dat het feature weg van het wegsegment getekend moet worden
 * @returns ol.StyleFunction
 */
export function offsetStyleFunction(
  styleFunction: ol.StyleFunction,
  ident8Veld: string,
  zijderijbaanVeld: string,
  offsetPixels: number
): ol.StyleFunction {
  function offsetStyleFunc(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
    const style: ol.style.Style | ol.style.Style[] = styleFunction(feature, resolution);

    if (!style) {
      return style;
    }

    return getValue(feature, ident8Veld).fold(
      () => {
        kaartLogger.error(`Ident8 is verplicht, er wordt geen offset getekend voor feature ${feature}`);
        return style;
      },
      ident8 => {
        return getValue(feature, zijderijbaanVeld).fold(
          () => {
            kaartLogger.error(`Zijderijbaan is verplicht, er wordt geen offset getekend voor feature ${feature}`);
            return style;
          },
          zijderijbaan => {
            const offsetGeometryFunc = offsetGeometryFunction(feature, ident8, zijderijbaan, offsetPixels, resolution);

            function setGeometry(s: ol.style.Style) {
              if (s instanceof ol.style.Style) {
                s.setGeometry(offsetGeometryFunc);
              }
            }

            if (Array.isArray(style)) {
              style.forEach(setGeometry);
            } else {
              setGeometry(style);
            }
            return style;
          }
        );
      }
    );
  }

  return offsetStyleFunc;
}

/**
 * Geeft een StyleGeometryFunction terug dat ge-embed kan worden in een ol.style.Style om de geometry van het feature te transformeren
 *
 * @param ol.Feature feature Het feature met de aan te passen geometry
 * @param string ident8 De ident8 waarde van het feature
 * @param string zijderijbaan De waarde van het zijderijbaan attribuut
 * @param number offsetPixels Aantal pixels dat het feature weg van het wegsegment getekend moet worden
 * @param number resolution De resolutie die getekend moet worden
 * @returns ol.StyleGeometryFunction
 */
function offsetGeometryFunction(
  feature: ol.Feature,
  ident8: string,
  zijderijbaan: string,
  offsetPixels: number,
  resolution: number
): ol.StyleGeometryFunction {
  const direction = getDirection(ident8);
  const zijde = getZijde(zijderijbaan, direction);

  function getOffsetGeometry(feat: ol.Feature): ol.geom.Geometry {
    const geometry = feat.getGeometry();
    if (!geometry || offsetPixels <= 0) {
      return geometry;
    }
    if (geometry instanceof ol.geom.LineString) {
      return getOffsetLinestring(<ol.geom.LineString>geometry, offsetPixels, resolution, zijde);
    } else if (geometry instanceof ol.geom.MultiLineString) {
      const multilinestring = <ol.geom.MultiLineString>geometry;
      const offsetMultiLinestring = new ol.geom.MultiLineString([]);

      multilinestring
        .getLineStrings()
        .forEach(linestring => offsetMultiLinestring.appendLineString(getOffsetLinestring(linestring, offsetPixels, resolution, zijde)));

      return offsetMultiLinestring;
    } else {
      kaartLogger.error(`De offset renderer wordt niet ondersteund voor geometries van type ${geometry.getType()}`);
      return geometry;
    }
  }

  return getOffsetGeometry;
}

function getOffsetLinestring(linestring: ol.geom.LineString, offsetPixels: number, resolution: number, zijde: string) {
  const offsetPoints: Array<ol.Coordinate> = []; // get the point objects from the geometry
  const oPoints = linestring.getCoordinates(); // get the original point objects from the geometry
  let offset = Math.abs(offsetPixels * resolution); // offset in map units (e.g. 'm': meter)
  if (zijde.toLowerCase() === "r") {
    offset = -1 * offset;
  }
  let lastX = 0,
    lastY = 0,
    thisX = 0,
    thisY = 0,
    moveX = 0,
    moveY = 0,
    loX = 0,
    loY = 0;
  let lastOffsetX = 0,
    lastOffsetY = 0,
    offsetX = 0,
    offsetY = 0,
    first = true;
  for (let i = 0; i < oPoints.length; i++) {
    if (i === 0) {
      moveX = lastX = oPoints[i][0];
      moveY = lastY = oPoints[i][1];
      first = true;
      continue;
    }

    thisX = oPoints[i][0];
    thisY = oPoints[i][1];
    // (dx,dy) is the vector from last point to the current point
    const dx = thisX - lastX;
    const dy = thisY - lastY;
    // segmentAngle is the angle of the linesegment between last and current points
    const segmentAngle = Math.atan2(dy, dx);
    offsetX = offset * Math.cos(segmentAngle + Math.PI / 2.0);
    offsetY = offset * Math.sin(segmentAngle + Math.PI / 2.0);
    // point (nloX, nloY) is last point + current offset vector
    const nloX = lastX + offsetX;
    const nloY = lastY + offsetY;
    if (first) {
      moveX = nloX;
      moveY = nloY;
      offsetPoints.push([moveX, moveY]);
      first = false;
    } else if (nloX !== loX || nloY !== loY) {
      // the formula for the signed angle between two vectors: ang = atan2(x1*y2-y1*x2,x1*x2+y1*y2
      const angleBetweenOffsetVectors = Math.atan2(
        lastOffsetX * offsetY - lastOffsetY * offsetX,
        lastOffsetX * offsetX + lastOffsetY * offsetY
      );
      const halfOffsetAngle = angleBetweenOffsetVectors / 2;
      // iRadius is the length of the vector along the bisector of the two consecutive offset vectors that starts
      // at the last point, and ends in the intersection of the two offset lines.
      let iRadius = offset / Math.cos(halfOffsetAngle);
      if (
        (offset > 0 && halfOffsetAngle < Math.PI / 2 + 0.00001 && halfOffsetAngle > Math.PI / 2 - 0.00001) ||
        (offset < 0 && halfOffsetAngle > -Math.PI / 2 - 0.00001 && halfOffsetAngle < -Math.PI / 2 + 0.000001)
      ) {
        // console.log("info: corner case offset rendering");
        // do nothing, the calculated iRadius will be extremely large since there offset vectors are
        // almost parallel
      } else if ((offset > 0 && halfOffsetAngle < -Math.PI / 4) || (offset < 0 && halfOffsetAngle > Math.PI / 4)) {
        // In these cases the offset-lines intersect too far beyond the last point
        // correct iRadius
        iRadius = offset / Math.cos(Math.PI / 4);
        let iloX = lastX + iRadius * Math.cos(segmentAngle + Math.PI / 2 - 2 * halfOffsetAngle - Math.sign(offset) * Math.PI / 4);
        let iloY = lastY + iRadius * Math.sin(segmentAngle + Math.PI / 2 - 2 * halfOffsetAngle - Math.sign(offset) * Math.PI / 4);
        offsetPoints.push([iloX, iloY]);
        iloX = lastX + iRadius * Math.cos(segmentAngle + Math.PI / 2 + Math.sign(offset) * Math.PI / 4);
        iloY = lastY + iRadius * Math.sin(segmentAngle + Math.PI / 2 + Math.sign(offset) * Math.PI / 4);
        offsetPoints.push([iloX, iloY]);
      } else {
        const iloX = lastX + iRadius * Math.cos(segmentAngle + Math.PI / 2 - halfOffsetAngle);
        const iloY = lastY + iRadius * Math.sin(segmentAngle + Math.PI / 2 - halfOffsetAngle);
        offsetPoints.push([iloX, iloY]);
      }
    }

    loX = nloX + dx;
    loY = nloY + dy;
    lastX = thisX;
    lastY = thisY;
    lastOffsetX = offsetX;
    lastOffsetY = offsetY;
  }
  offsetPoints.push([loX, loY]);
  return new ol.geom.LineString(offsetPoints);
}

function getValue(feature: ol.Feature, field: string): Option<string> {
  return option.fromNullable(feature.get("properties")).chain(properties => option.fromNullable(properties[field]));
}

function getDirection(ident8) {
  return ident8 && ident8.endsWith("2") ? "down" : "up";
}

function getZijde(zijderijweg: string, direction: string) {
  return (zijderijweg === "l" || zijderijweg === "L") === (direction === "up") ? "l" : "r";
}
