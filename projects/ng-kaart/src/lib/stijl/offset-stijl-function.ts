import { option } from "fp-ts";

import { kaartLogger } from "../kaart/log";
import * as ol from "../util/openlayers-compat";

type Direction = "up" | "down";

const Up = "up" as Direction;
const Down = "down" as Direction;

/**
 * Gegeven een StyleFunction zonder offset rendering, geef er 1 terug waarbij de features op een offset gerendered worden.
 *
 * @param ol.style.StyleFunction styleFunction Oorspronkelijke stijl functie
 * @param string ident8Veld Plaats waar het ident8 veld te vinden is onder feature.properties
 * @param string zijderijbaanVeld Plaats waar de kant van de weg van het feature te vinden is onder feature.properties ('R', 'L', 'M'/'O')
 * @param number positie De index van de te stylen laag.
 *                       Positie 0 bevat geen offset, positie 1 bevat offset van 1 x strokeWidth van stijl, enz
 * @returns ol.style.StyleFunction
 */
export function offsetStyleFunction(
  styleFunction: ol.style.StyleFunction,
  ident8Veld: string,
  zijderijbaanVeld: string,
  positie: number,
  rijrichtingIsDigitalisatieZin: boolean
): ol.style.StyleFunction {
  function offsetStyleFunc(
    feature: ol.Feature,
    resolution: number
  ): ol.style.Style | ol.style.Style[] {
    const style: ol.style.Style | ol.style.Style[] = styleFunction(
      feature,
      resolution
    );

    // indien de geometry geen segment is, er geen stijl gedefinieerd is of we geen rijrichting kunnen afleiden
    // (als er geen ident8 is en de rijrichting is niet de digitalisatie zin),
    // dan sturen we gewoon de style terug zonder offset toegepast
    if (
      (!(feature.getGeometry() instanceof ol.geom.LineString) &&
        !(feature.getGeometry() instanceof ol.geom.MultiLineString)) ||
      !style ||
      (!rijrichtingIsDigitalisatieZin && getValue(feature, ident8Veld).isNone())
    ) {
      return style;
    }

    const direction: Direction = rijrichtingIsDigitalisatieZin
      ? Up
      : getValue(feature, ident8Veld).foldL(
          () => Up,
          (ident8) => getDirection(ident8)
        );

    function setGeometryOnStyle(s: ol.style.Style) {
      const offsetGeometryFunc = offsetGeometryFunction(
        direction,
        // Niet alle lijntypes hebben expliciet een offsetzijde. Indien geen zijderijbaan waarde gevonden,
        // veronderstellen we rechter zijde
        getValue(feature, zijderijbaanVeld).getOrElse("r"),
        positie * (s.getStroke().getWidth() || 1),
        resolution
      );

      if (s instanceof ol.style.Style) {
        s.setGeometry(offsetGeometryFunc);
      }
    }

    if (Array.isArray(style)) {
      style.forEach(setGeometryOnStyle);
    } else {
      setGeometryOnStyle(style);
    }
    return style;
  }

  return offsetStyleFunc;
}

function getValue(feature: ol.Feature, field: string): option.Option<string> {
  return option
    .fromNullable(feature.get("properties"))
    .chain((properties) => option.fromNullable(properties[field]));
}

/**
 * Geeft een StyleGeometryFunction terug dat ge-embed kan worden in een ol.style.Style om de geometry van het feature te transformeren
 *
 * @param ol.Feature feature Het feature met de aan te passen geometry
 * @param Direction direction Richting van het lijnsegment ('up' of 'down')
 * @param string zijderijbaan De waarde van het zijderijbaan attribuut
 * @param number offsetPixels Aantal pixels dat het feature weg van het wegsegment getekend moet worden
 * @param number resolution De resolutie die getekend moet worden
 * @returns ol.StyleGeometryFunction
 */
function offsetGeometryFunction(
  direction: Direction,
  zijderijbaan: string,
  offsetPixels: number,
  resolution: number
): ol.style.GeometryFunction {
  const zijdeSpiegeling = getZijdeSpiegeling(zijderijbaan, direction);

  function getOffsetGeometry(geometry: ol.geom.Geometry): ol.geom.Geometry {
    if (offsetPixels <= 0) {
      return geometry;
    }
    if (!geometry || offsetPixels <= 0) {
      return geometry;
    }
    try {
      if (geometry instanceof ol.geom.LineString) {
        return getOffsetLinestring(
          <ol.geom.LineString>geometry,
          offsetPixels,
          resolution,
          zijdeSpiegeling
        );
      } else if (geometry instanceof ol.geom.MultiLineString) {
        const multilinestring = <ol.geom.MultiLineString>geometry;
        const offsetMultiLinestring = new ol.geom.MultiLineString([]);

        multilinestring
          .getLineStrings()
          .forEach((linestring) =>
            offsetMultiLinestring.appendLineString(
              getOffsetLinestring(
                linestring,
                offsetPixels,
                resolution,
                zijdeSpiegeling
              )
            )
          );

        return offsetMultiLinestring;
      } else {
        return geometry;
      }
    } catch (e) {
      kaartLogger.error(`Kan offset voor geometry niet berekenen. Fout: ${e}`);
      return geometry;
    }
  }

  return (feature: ol.Feature) => {
    const geometry = feature.getGeometry();
    return geometry ? getOffsetGeometry(geometry) : undefined;
  };
}

const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;

type ZijdeSpiegeling = 1 | -1;

function getOffsetLinestring(
  linestring: ol.geom.LineString,
  offsetPixels: number,
  resolution: number,
  zijdeSpiegeling: ZijdeSpiegeling
) {
  const offsetPoints: Array<ol.Coordinate> = []; // get the point objects from the geometry
  const oPoints = linestring.getCoordinates(); // get the original point objects from the geometry
  const offset = zijdeSpiegeling * Math.abs(offsetPixels * resolution); // offset in map units (e.g. 'm': meter)
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
    offsetX = offset * Math.cos(segmentAngle + HALF_PI);
    offsetY = offset * Math.sin(segmentAngle + HALF_PI);
    // point (nloX, nloY) is last point + current offset vector
    const nloX = lastX + offsetX;
    const nloY = lastY + offsetY;
    if (first) {
      moveX = nloX;
      moveY = nloY;
      offsetPoints.push([moveX, moveY]);
      first = false;
    } else if (nloX !== loX || nloY !== loY) {
      // the formula for the signed angle between two vectors: ang = atan2(x1*y2-y1*x2,x1*x2+y1*y2)
      const angleBetweenOffsetVectors = Math.atan2(
        lastOffsetX * offsetY - lastOffsetY * offsetX,
        lastOffsetX * offsetX + lastOffsetY * offsetY
      );
      const halfOffsetAngle = angleBetweenOffsetVectors / 2;
      // iRadius is the length of the vector along the bisector of the two consecutive offset vectors that starts
      // at the last point, and ends in the intersection of the two offset lines.
      let iRadius = offset / Math.cos(halfOffsetAngle);

      if (
        (offset > 0 && closeTo(halfOffsetAngle, HALF_PI)) ||
        (offset < 0 && closeTo(halfOffsetAngle, -HALF_PI))
      ) {
        // corner case offset rendering
        // do nothing, the calculated iRadius will be extremely large since their offset vectors are
        // almost parallel
      } else if (
        (offset > 0 && halfOffsetAngle < -QUARTER_PI) ||
        (offset < 0 && halfOffsetAngle > QUARTER_PI)
      ) {
        // In these cases the offset-lines intersect too far beyond the last point
        // correct iRadius
        iRadius = offset / Math.cos(QUARTER_PI);
        let iloX =
          lastX +
          iRadius *
            Math.cos(
              segmentAngle +
                HALF_PI -
                2 * halfOffsetAngle -
                Math.sign(offset) * QUARTER_PI
            );
        let iloY =
          lastY +
          iRadius *
            Math.sin(
              segmentAngle +
                HALF_PI -
                2 * halfOffsetAngle -
                Math.sign(offset) * QUARTER_PI
            );
        offsetPoints.push([iloX, iloY]);
        iloX =
          lastX +
          iRadius *
            Math.cos(segmentAngle + HALF_PI + Math.sign(offset) * QUARTER_PI);
        iloY =
          lastY +
          iRadius *
            Math.sin(segmentAngle + HALF_PI + Math.sign(offset) * QUARTER_PI);
        offsetPoints.push([iloX, iloY]);
      } else {
        const iloX =
          lastX + iRadius * Math.cos(segmentAngle + HALF_PI - halfOffsetAngle);
        const iloY =
          lastY + iRadius * Math.sin(segmentAngle + HALF_PI - halfOffsetAngle);
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

function closeTo(value1: number, value2: number) {
  return value1 < value2 + 0.00001 && value1 > value2 - 0.00001;
}

const wegnummerRegex = /^[ABNRFT][0-9]+([hatrfpz]|bob)([0-9])([0-9])*$/gm;
function getDirection(ident8: string): Direction {
  const match = wegnummerRegex.exec(ident8);
  if (match !== null) {
    // het eerste cijfer van de laatste cijfers toont de richting aan, oneven => oplopend
    const direction = parseInt(match[2], 10);
    return direction % 2 === 0 ? Down : Up;
  } else {
    return ident8 && ident8.endsWith("2") ? Down : Up;
  }
}

function getZijdeSpiegeling(
  zijderijweg: string,
  direction: Direction
): ZijdeSpiegeling {
  return (zijderijweg === "l" || zijderijweg === "L") === (direction === "up")
    ? 1
    : -1;
}
