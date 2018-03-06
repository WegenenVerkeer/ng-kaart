import { Component, ViewEncapsulation } from "@angular/core";
import * as ol from "openlayers";
import "rxjs/add/operator/mergeMap";
import "rxjs/add/operator/map";

import { GoogleLocatieZoekerService } from "../lib/google-locatie-zoeker";
import { CoordinatenService } from "../lib/kaart";
import { kaartLogger, definitieToStyle } from "../lib/public_api";
import { AWV0StyleFunctionDescription, definitieToStyleFunction } from "../lib/stijl";
import { type } from "os";
import * as OpenLayers from "openlayers";

@Component({
  selector: "awv-ng-kaart-test-app",
  templateUrl: "./app.component.html",
  styleUrls: ["app.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  private readonly zichtbaarheid = {
    fietspaden: true // standard falsey
  };

  private readonly pinIcon = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: "fraction",
      anchorYUnits: "fraction",
      scale: 1,
      opacity: 1,
      src: "./material-design-icons/maps/svg/production/ic_place_48px.svg"
    }),
    text: new ol.style.Text({
      font: "12px 'Helvetica Neue', sans-serif",
      fill: new ol.style.Fill({ color: "#000" }),
      offsetY: -60,
      stroke: new ol.style.Stroke({
        color: "#fff",
        width: 2
      }),
      text: "Zis is a pin"
    })
  });

  private readonly fietspadStijlDef: AWV0StyleFunctionDescription = {
    version: "awv-v0",
    definition: {
      rules: [
        {
          condition: {
            kind: "==",
            left: { kind: "Property", type: "string", ref: "typefietspad" },
            right: { kind: "Literal", value: "Vrijliggend" }
          },
          style: {
            definition: { stroke: { color: "green", width: 1.5 } }
          }
        },
        {
          condition: {
            kind: "==",
            left: { kind: "Property", type: "string", ref: "typefietspad" },
            right: { kind: "Literal", value: "Aanliggend Verhoogd" }
          },
          style: {
            definition: { stroke: { color: "#FFFF00", width: 1.5 } }
          }
        },
        {
          condition: {
            kind: "==",
            left: { kind: "Property", type: "string", ref: "typefietspad" },
            right: { kind: "Literal", value: "Aanliggend" }
          },
          style: {
            definition: { stroke: { color: "#FF7F00", width: 1.5 } }
          }
        }
      ]
    }
  };

  polygoonEvents: string[] = [];
  installatieGeselecteerdEvents: string[] = [];
  geoJsonFormatter = new ol.format.GeoJSON();

  locatieQuery: string;
  installaties: ol.Feature[] = [];
  zoekresultaten: ol.Collection<ol.Feature> = new ol.Collection();

  installatie: ol.Coordinate = [169500, 190500];
  installatieExtent: ol.Extent = [180000, 190000, 181000, 191000];

  lat = 4.7970553;
  long = 51.0257317;

  // Dit werkt alleen als apigateway bereikbaar is. Zie CORS waarschuwing in README.
  readonly districtSource: ol.source.Vector = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function(extent) {
      return (
        `http://apigateway/geoserver/wfs/?service=WFS&version=1.1.0&request=GetFeature&` +
        `typename=awv:districten&` +
        "outputFormat=application/json&srsname=EPSG:31370&" +
        `bbox=${extent.join(",")},EPSG:31370`
      );
    },
    strategy: ol.loadingstrategy.bbox
  });

  readonly districtStyle: ol.style.Style = definitieToStyle(
    "json",
    '{"version": "awv-v0", "definition": {"stroke": {"color": "rgba(0,127,255,0.8)", "width": 1.5}}}'
  ).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  readonly kolkStyle: ol.style.Style = definitieToStyle(
    "json",
    // tslint:disable-next-line:max-line-length
    '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "navy", "width": 1.5}, "fill": {"color": "dodgerblue"}, "radius": 6}}}'
  ).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  readonly fietspadStyle: ol.StyleFunction = definitieToStyleFunction(
    "json",
    // tslint:disable-next-line:max-line-length
    JSON.stringify(this.fietspadStijlDef)
  ).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  readonly offsetFunction: ol.StyleFunction = function(toRenderFeature, res) {
    const checkDirection = function(ident8) {
      if (ident8 && ident8.charAt(ident8.length - 1) === "2") {
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
    const signum = function(x) {
      if (x > 0) {
        return 1;
      } else if (x < 0) {
        return -1;
      } else {
        return 0;
      }
    };
    // TODO: parameter direction (voor punten) tijdelijk niet
    const applyOffset = function(feature: ol.Feature, offsetPx: number, resolution: number, side: string): ol.geom.Geometry {
      const geometry = feature.getGeometry();
      if (!geometry || offsetPx <= 0) {
        return geometry;
      }
      if (geometry instanceof ol.geom.LineString) {
        // of return layer.hasOwnProperty("getSource") ? some(layer as ol.layer.Vector) : none; ?
        const linestring = <ol.geom.LineString>geometry;
        const offsetPoints: Array<ol.Coordinate> = []; // get the point objects from the geometry
        const oPoints = linestring.clone().getCoordinates(); // get the original point objects from the geometry
        let offset = Math.abs(offsetPx * resolution); // offset in map units (e.g. 'm': meter)
        if (side.toLowerCase() === "r") {
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
              let iloX = lastX + iRadius * Math.cos(segmentAngle + Math.PI / 2 - 2 * halfOffsetAngle - signum(offset) * Math.PI / 4);
              let iloY = lastY + iRadius * Math.sin(segmentAngle + Math.PI / 2 - 2 * halfOffsetAngle - signum(offset) * Math.PI / 4);
              offsetPoints.push([iloX, iloY]);
              iloX = lastX + iRadius * Math.cos(segmentAngle + Math.PI / 2 + signum(offset) * Math.PI / 4);
              iloY = lastY + iRadius * Math.sin(segmentAngle + Math.PI / 2 + signum(offset) * Math.PI / 4);
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
    };

    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "blue",
        width: 3
      }),
      fill: new ol.style.Fill({
        color: "rgba(0, 0, 255, 0.1)"
      }),
      geometry: function(feature: ol.Feature) {
        const zijderijweg = feature.getProperties()["properties"]["zijderijbaan"];
        const ident8 = feature.getProperties()["properties"]["ident8"];
        const direction = checkDirection(ident8);
        const zijde = getZijde(zijderijweg, direction);
        return applyOffset(feature, 10, res, zijde);
      }
    });
  };

  constructor(private googleLocatieZoekerService: GoogleLocatieZoekerService, public coordinatenService: CoordinatenService) {
    kaartLogger.setLevel("DEBUG");
    this.addIcon();
  }

  isZichtbaar(part: string): boolean {
    return this.zichtbaarheid[part];
  }

  maakZichtbaar(part: string, zichtbaar: boolean) {
    this.zichtbaarheid[part] = zichtbaar;
  }

  private addIcon() {
    if (this.installaties.length > 20) {
      this.installaties = [];
    }
    const locatie: [number, number] = [
      this.installatie[0] + (Math.random() - 0.5) * 3000,
      this.installatie[1] + (Math.random() - 0.5) * 3000
    ];
    const feature = new ol.Feature(new ol.geom.Point(locatie));
    feature.setStyle(this.pinIcon);
    this.installaties.push(feature);
    setTimeout(() => this.addIcon(), 1000);
  }

  polygoonGetekend(feature: ol.Feature) {
    this.polygoonEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  installatieGeselecteed(feature: ol.Feature) {
    this.installatieGeselecteerdEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  zoekLocaties(locatieQuery: String) {
    this.googleLocatieZoekerService
      .zoek(locatieQuery)
      .flatMap(res => res.resultaten)
      .map(zoekresultaat => zoekresultaat.geometry)
      .map(geometry => new ol.Feature(geometry))
      .subscribe(feature => this.zoekresultaten.push(feature));
  }
}
