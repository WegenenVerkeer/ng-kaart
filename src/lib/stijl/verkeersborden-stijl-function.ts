import * as ol from "openlayers";

import { kaartLogger } from "../kaart/log";
import { definitieToStyle } from "../public_api";
import { join } from "../util/validation";

/**
 * De verkeersborden rendering heeft 4 verschillende voorstellingen afhankelijk van het zoomniveau. Voor elk van deze voorstellingen wordt
 * een andere view gebruikt die reeds aanwezig is in de nosql featureserver. Hoe meer informatie er nodig is om de opstelling weer te geven,
 * hoe meer data er wordt opgehaald.
 *
 * Van ondiep naar diepste zoomniveau:
 *  1. opstellingAlsPunt: elke opstelling weergegeven als punt op de kaart.
 *     'default' view wordt gebruikt, bevat de minste data, enkel locatie informatie en geometrie van de opstelling
 *  2. opstellingMetHoek: elke opstelling met een icoon die de hoek van de aanzichten weergeeft
 *     'opstelling' view wordt gebruikt. Bevat het te gebruiken icoon base64 geencodeerd
 *  3. opstellingMetAanzichten: elke opstelling met al zijn aanzichten. Bevat eveneens de grafische voorstelling van alle aanzichten met
 *      2 groottes.
 *     'aanzicht' view wordt gebruikt. Bevat twee grafische voorstellingen van elk aanzicht + hoek
 *
 */

const format = new ol.format.GeoJSON();

const basisOpstellingStyle: ol.style.Style = definitieToStyle(
  "json",
  // tslint:disable-next-line:max-line-length
  '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "black", "width": 1.5}, "fill": {"color": "black"}, "radius": 3}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(msg)}`);
});

const basisOpstellingGeselecteerdStyle: ol.style.Style = definitieToStyle(
  "json",
  // tslint:disable-next-line:max-line-length
  '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "#25FFFF", "width": 1.5}, "fill": {"color": "#25FFFF"}, "radius": 3}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(msg)}`);
});

const basisAanzichtStyle: ol.style.Style = definitieToStyle(
  "json",
  // tslint:disable-next-line:max-line-length
  '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "LIGHTSALMON", "width": 1.5}, "fill": {"color": "INDIANRED"}, "radius": 3}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(msg)}`);
});

const basisVerbindingsLijnStyle: ol.style.Style = definitieToStyle(
  "json",
  '{"version": "awv-v0", "definition": {"stroke": {"color": "black", "width": 2}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(msg)}`);
});

basisOpstellingStyle.setZIndex(0);
basisAanzichtStyle.setZIndex(1);
basisVerbindingsLijnStyle.setZIndex(-1);

export function verkeersbordenStyleFunction(geselecteerd: boolean): ol.StyleFunction {
  function styleFunc(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
    // [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125]

    if (resolution <= 0.125) {
      return geselecteerd
        ? opstellingMetAanzichten(feature, "platgeslagenvoorstellinggeselecteerd", geselecteerd)
        : opstellingMetAanzichten(feature, "platgeslagenvoorstelling", geselecteerd);
    } else if (resolution <= 0.25) {
      return geselecteerd
        ? opstellingMetAanzichten(feature, "platgeslagenvoorstellingkleingeselecteerd", geselecteerd)
        : opstellingMetAanzichten(feature, "platgeslagenvoorstellingklein", geselecteerd);
    } else if (resolution <= 0.5) {
      return opstellingMetHoek(feature, geselecteerd);
    } else {
      return opstellingAlsPunt(feature, geselecteerd);
    }
  }

  return styleFunc;
}

function opstellingMetAanzichten(feature: ol.Feature, binairImageVeld: string, geselecteerd: boolean): ol.style.Style[] {
  const opstelling = feature.getProperties()["properties"];

  const opstellingPoint = feature.getGeometry() as ol.geom.Point;

  const aanzichtStyles = [];

  if (!opstelling.aanzichten) {
    kaartLogger.error("Geen aanzicht informatie gevonden");
    return;
  }

  opstelling.aanzichten.forEach(aanzicht => {
    const aanzichtStyle = basisAanzichtStyle.clone();

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

    aanzichtStyle.setImage(createIcon(src, grootte, rotation, true));
    aanzichtStyles.push(aanzichtStyle);

    const verbindingsLijn = basisVerbindingsLijnStyle.clone();
    if (geselecteerd) {
      verbindingsLijn.getStroke().setColor("#25FFFF");
    }
    verbindingsLijn.setGeometry(new ol.geom.LineString([opstellingPoint.getCoordinates(), ankerGeometry.getCoordinates()]));
    aanzichtStyles.push(verbindingsLijn);
  });

  aanzichtStyles.push(opstellingMetHoek(feature, geselecteerd));
  return aanzichtStyles;
}

function opstellingMetHoek(feature: ol.Feature, geselecteerd: boolean): ol.style.Style {
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

  const src = geselecteerd
    ? encodeAsSrc(
        opstelling["binaireData"]["kaartvoorstellinggeselecteerd"]["mime"],
        opstelling["binaireData"]["kaartvoorstellinggeselecteerd"]["data"]
      )
    : encodeAsSrc(opstelling["binaireData"]["kaartvoorstelling"]["mime"], opstelling["binaireData"]["kaartvoorstelling"]["data"]);
  opstellingStyle.setImage(createIcon(src, grootte, rotation, false));

  feature.changed(); // side-effect functie -- spijtig genoeg nodig om OL het sein te geven dat de image hertekend moet worden...

  return opstellingStyle;
}

function opstellingAlsPunt(feature: ol.Feature, geselecteerd: boolean): ol.style.Style {
  return geselecteerd ? basisOpstellingGeselecteerdStyle : basisOpstellingStyle;
}

function createIcon(base64: string, size: ol.Size, rotation: number, zetAnchor: boolean): ol.style.Icon {
  // Door openlayers bug kan je hier geen image aanmaken via deze code, want dat geeft flikkering bij herhaaldelijk onnodig tekenen
  // indien er meer dan 33 features zijn.
  //
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
    rotation: rotation,
    anchor: zetAnchor ? [0.5, 1] : [0.5, 0.5] // indien gezet, zet icon anchor midden onderaan bord, anders default in midden van icon
  });
}

function encodeAsSrc(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}
