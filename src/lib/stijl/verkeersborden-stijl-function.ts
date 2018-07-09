import * as ol from "openlayers";

import { kaartLogger } from "../kaart/log";
import { definitieToStyle } from "../public_api";
import { join } from "../util/validation";

const format = new ol.format.GeoJSON();

const basisOpstellingStyle: ol.style.Style = definitieToStyle(
  "json",
  // tslint:disable-next-line:max-line-length
  '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "black", "width": 1.5}, "fill": {"color": "black"}, "radius": 3}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(msg)}`);
});

const basisAanstellingStyle: ol.style.Style = definitieToStyle(
  "json",
  // tslint:disable-next-line:max-line-length
  '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "LIGHTSALMON", "width": 1.5}, "fill": {"color": "INDIANRED"}, "radius": 3}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(msg)}`);
});

const basisVerbindingsLijnStyle: ol.style.Style = definitieToStyle(
  "json",
  '{"version": "awv-v0", "definition": {"stroke": {"color": "black", "width": 1.5}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(msg)}`);
});

basisOpstellingStyle.setZIndex(0);
basisAanstellingStyle.setZIndex(1);
basisVerbindingsLijnStyle.setZIndex(-1);

export function verkeersbordenStyleFunction(): ol.StyleFunction {
  function styleFunc(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
    // [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125]

    if (resolution <= 0.125) {
      return opstellingMetAanzichten(feature, "platgeslagenvoorstelling");
    } else if (resolution <= 0.25) {
      return opstellingMetAanzichten(feature, "platgeslagenvoorstellingklein");
    } else if (resolution <= 0.5) {
      return opstellingMetHoek(feature);
    } else {
      return opstellingAlsPunt(feature);
    }
  }

  return styleFunc;
}

function opstellingMetAanzichten(feature: ol.Feature, binairImageVeld: string): ol.style.Style[] {
  const opstellingStyle = basisOpstellingStyle.clone();

  const opstellingPoint = feature.getGeometry() as ol.geom.Point;
  opstellingStyle.setGeometry(new ol.geom.Point(opstellingPoint.getCoordinates()));

  const opstelling = feature.getProperties()["properties"];

  const aanzichtStyles = [];

  opstelling.aanzichten.forEach(aanzicht => {
    const aanzichtStyle = basisAanstellingStyle.clone();

    const ankerGeometry = format.readGeometry(aanzicht.anker) as ol.geom.Point;

    aanzichtStyle.setGeometry(ankerGeometry);

    const grootte: ol.Size = [
      aanzicht["binaireData"][binairImageVeld]["properties"]["breedte"],
      aanzicht["binaireData"][binairImageVeld]["properties"]["hoogte"]
    ];

    // They define their angles differently than normal geometry. 0 degrees is on top, and their angles increase
    // clockwis instead of counterclockwise.
    const rotation: number = aanzicht["hoek"] ? -1 * aanzicht["hoek"] : 0;

    const src = encodeAsSrc(aanzicht["binaireData"][binairImageVeld]["mime"], aanzicht["binaireData"][binairImageVeld]["data"]);

    aanzichtStyle.setImage(createIcon(src, grootte, rotation));
    aanzichtStyles.push(aanzichtStyle);

    const verbindingsLijn = basisVerbindingsLijnStyle.clone();
    verbindingsLijn.setGeometry(new ol.geom.LineString([opstellingPoint.getCoordinates(), ankerGeometry.getCoordinates()]));
    aanzichtStyles.push(verbindingsLijn);
  });

  aanzichtStyles.push(opstellingStyle);
  return aanzichtStyles;
}

function opstellingMetHoek(feature: ol.Feature): ol.style.Style {
  const opstellingStyle = basisOpstellingStyle.clone();

  const opstelling = feature.getProperties()["properties"];

  const opstellingPoint = feature.getGeometry() as ol.geom.Point;
  opstellingStyle.setGeometry(opstellingPoint);

  const grootte: ol.Size = [
    opstelling["binaireData"]["kaartvoorstelling"]["properties"]["breedte"],
    opstelling["binaireData"]["kaartvoorstelling"]["properties"]["hoogte"]
  ];

  // They define their angles differently than normal geometry. 0 degrees is on top, and their angles increase
  // clockwis instead of counterclockwise.
  const rotation: number = opstelling["delta"] ? -1 * opstelling["delta"] : 0;

  const src = encodeAsSrc(opstelling["binaireData"]["kaartvoorstelling"]["mime"], opstelling["binaireData"]["kaartvoorstelling"]["data"]);
  opstellingStyle.setImage(createIcon(src, grootte, rotation));

  return opstellingStyle;
}

function opstellingAlsPunt(feature: ol.Feature): ol.style.Style {
  const opstellingStyle = basisOpstellingStyle.clone();
  const opstellingPoint = feature.getGeometry() as ol.geom.Point;
  opstellingStyle.setGeometry(opstellingPoint);
  return opstellingStyle;
}

function createIcon(base64: string, size: ol.Size, rotation: number): ol.style.Icon {
  // Door openlayers bug kan je hier geen image aanmaken via deze code:
  //  new ol.style.Icon({
  //         src: base64,
  //         size: size,
  //         rotation: rotation
  //       })
  // Zie https://github.com/openlayers/openlayers/issues/3137
  // Zie https://stackoverflow.com/questions/32012495/openlayers-3-layer-style-issue
  // HtmlImageElement lost dit op
  const image = document.createElement("img") as HTMLImageElement;
  image.src = base64;

  return new ol.style.Icon({
    img: image,
    imgSize: size,
    rotation: rotation
  });
}

function encodeAsSrc(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}
