import * as ol from "openlayers";

export function getGeometryFunction(feature: ol.Feature, ident8: string, zijderijbaan: string, offsetPx: number): ol.StyleGeometryFunction {
  const direction = getDirection(ident8);
  const zijde = getZijde(zijderijbaan, direction);

  function getOffsetGeometry(feat: ol.Feature): ol.geom.Geometry {
    const geometry = feat.getGeometry();
    if (!geometry || offsetPx <= 0) {
      return geometry;
    }
    if (geometry instanceof ol.geom.LineString) {
      // of return layer.hasOwnProperty("getSource") ? some(layer as ol.layer.Vector) : none; ?
      const linestring = <ol.geom.LineString>geometry;
      const offsetPoints: Array<ol.Coordinate> = []; // get the point objects from the geometry
      const oPoints = linestring.clone().getCoordinates(); // get the original point objects from the geometry
      let offset = Math.abs(offsetPx); // offset in map units (e.g. 'm': meter)
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
    } else {
      // TODO: we don't do other geometries yet.
      return geometry;
    }
  }

  return getOffsetGeometry;
}

const getDirection = function(ident8) {
  if (ident8 && ident8.endsWith("2")) {
    return "down";
  }
  return "up";
};

const getZijde = function(zijderijweg: string, direction: string) {
  if (zijderijweg.toLowerCase() !== "l") {
    if (direction === "up") {
      return "l";
    } else {
      return "r";
    }
  } else {
    if (direction === "up") {
      return "r";
    } else {
      return "l";
    }
  }
};
