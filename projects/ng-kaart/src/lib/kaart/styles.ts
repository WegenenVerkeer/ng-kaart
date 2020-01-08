import * as ol from "../util/openlayers-compat";

import { StaticStyle, StyleSelector } from "./stijl-selector";

const defaultStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "#5555FF40"
  }),
  stroke: new ol.style.Stroke({
    color: "darkslateblue ",
    width: 4
  }),
  image: new ol.style.Circle({
    fill: new ol.style.Fill({
      color: "maroon"
    }),
    stroke: new ol.style.Stroke({
      color: "gray",
      width: 1.25
    }),
    radius: 5
  })
});

export function getDefaultStyle(): ol.style.Style {
  return defaultStyle;
}

export function getDefaultStyleSelector(): StyleSelector {
  return StaticStyle(defaultStyle);
}

export function getDefaultSelectionStyleSelector(): StyleSelector {
  return getDefaultStyleSelector();
}

export function getDefaultStyleFunction(): ol.style.StyleFunction {
  return () => defaultStyle;
}

const styles = createEditingStyles();

export function getDefaultSelectionStyleFunction(): ol.style.StyleFunction {
  return feature => {
    const geometry = feature.getGeometry();
    if (!geometry) {
      return getDefaultStyle();
    } else {
      return styles[geometry.getType()];
    }
  };
}

export function getDefaultHoverStyleFunction(): ol.style.StyleFunction {
  return getDefaultSelectionStyleFunction();
}

function createEditingStyles() {
  const white: ol.Color = [255, 255, 255, 1];
  const blue: ol.Color = [0, 153, 255, 1];
  const width = 3;
  const styles = {};
  styles["Polygon"] = [
    new ol.style.Style({
      fill: new ol.style.Fill({
        color: [255, 255, 255, 0.5]
      })
    })
  ];
  styles["MultiPolygon"] = styles["Polygon"];
  styles["LineString"] = [
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: white,
        width: width + 2
      })
    }),
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: blue,
        width: width
      })
    })
  ];
  styles["MultiLineString"] = styles["LineString"];
  styles["Point"] = [
    new ol.style.Style({
      image: new ol.style.Circle({
        radius: width * 2,
        fill: new ol.style.Fill({
          color: blue
        }),
        stroke: new ol.style.Stroke({
          color: white,
          width: width / 2
        })
      }),
      zIndex: Infinity
    })
  ];
  styles["MultiPoint"] = styles["Point"];
  styles["GeometryCollection"] = styles["Polygon"].concat(styles["Point"]);
  return styles;
}
