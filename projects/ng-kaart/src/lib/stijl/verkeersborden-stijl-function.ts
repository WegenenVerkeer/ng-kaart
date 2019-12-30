import { kaartLogger } from "../kaart/log";
import * as ol from "../util/openlayers-compat";
import { join } from "../util/string";

import { definitieToStyle } from "./stijl-static";

/**
 * De verkeersborden rendering heeft 4 verschillende voorstellingen afhankelijk van het zoomniveau.
 *
 * Van ondiep naar diepste zoomniveau:
 *  1. opstellingAlsPunt: elke opstelling weergegeven als punt op de kaart.
 *  2. opstellingMetHoek: elke opstelling met een icoon die de hoek van de aanzichten weergeeft
 *  3. opstellingMetAanzichten: elke opstelling met al zijn aanzichten, kleine voorstelling
 *  4. opstellingMetAanzichten: elke opstelling met al zijn aanzichten, grote voorstelling
 *
 */

const format = new ol.format.GeoJSON();

const basisOpstellingStyle: ol.style.Style = definitieToStyle(
  "json",
  // tslint:disable-next-line:max-line-length
  '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "black", "width": 1.5}, "fill": {"color": "black"}, "radius": 3}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(",")(msg)}`);
});

const basisOpstellingGeselecteerdStyle: ol.style.Style = definitieToStyle(
  "json",
  // tslint:disable-next-line:max-line-length
  '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "#25FFFF", "width": 1.5}, "fill": {"color": "#25FFFF"}, "radius": 3}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(",")(msg)}`);
});

const basisVerbindingsLijnStyle: ol.style.Style = definitieToStyle(
  "json",
  '{"version": "awv-v0", "definition": {"stroke": {"color": "black", "width": 2}}}'
).getOrElseL(msg => {
  throw new Error(`slecht formaat ${join(",")(msg)}`);
});

basisOpstellingStyle.setZIndex(0);
basisVerbindingsLijnStyle.setZIndex(-1);

export function verkeersbordenStyleFunction(geselecteerd: boolean): ol.StyleFunction {
  function styleFunc(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
    // [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125]

    if (resolution <= 0.125) {
      return opstellingMetAanzichten(feature, geselecteerd, false);
    } else if (resolution <= 0.25) {
      return opstellingMetAanzichten(feature, geselecteerd, true);
    } else if (resolution <= 0.5) {
      return opstellingMetHoek(feature, geselecteerd);
    } else {
      return opstellingAlsPunt(feature, geselecteerd);
    }
  }

  return styleFunc;
}

function opstellingMetAanzichten(feature: ol.Feature, geselecteerd: boolean, klein: boolean): ol.style.Style[] {
  const opstelling: Opstelling = feature.getProperties()["properties"];

  const opstellingPoint: ol.geom.Point = feature.getGeometry() as ol.geom.Point;

  const aanzichtStyles: ol.style.Style[] = [];

  if (!opstelling.aanzichten) {
    kaartLogger.error("Geen aanzicht informatie gevonden");
    return [opstellingAlsPunt(feature, geselecteerd)]; // val terug op simpele voorstelling
  }

  opstelling.aanzichten.forEach(aanzicht => {
    const ankerGeometry: ol.geom.Point = aanzicht.anker
      ? (format.readGeometry(aanzicht.anker) as ol.geom.Point)
      : (opstellingPoint.clone() as ol.geom.Point);
    const image = imageAanzicht(aanzicht.binaireData, geselecteerd, klein);
    const rotation: number = transformeerHoek(aanzicht.hoek);

    const aanzichtStyle = new ol.style.Style({
      image: createIcon(encodeAsSrc(image.mime, image.data), [image.properties.breedte, image.properties.hoogte], rotation, true),
      geometry: ankerGeometry
    });
    aanzichtStyle.setZIndex(1);

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
  const opstelling: Opstelling = feature.getProperties()["properties"];
  const opstellingStyle = basisOpstellingStyle.clone();
  const image = imageOpstelling(opstelling.binaireData, geselecteerd);
  const rotation: number = transformeerHoek(opstelling.delta);

  opstellingStyle.setGeometry(feature.getGeometry() as ol.geom.Point);
  opstellingStyle.setImage(
    createIcon(encodeAsSrc(image.mime, image.data), [image.properties.breedte, image.properties.hoogte], rotation, false)
  );

  if (geselecteerd) {
    feature.changed(); // side-effect functie -- spijtig genoeg nodig om OL het sein te geven dat de image hertekend moet worden...
  }

  return opstellingStyle;
}

function opstellingAlsPunt(feature: ol.Feature, geselecteerd: boolean): ol.style.Style {
  return geselecteerd ? basisOpstellingGeselecteerdStyle : basisOpstellingStyle;
}

interface Opstelling {
  readonly aanzichten: Aanzicht[];
  readonly delta: number;
  readonly binaireData: BinaireOpstellingData;
}

interface BinaireOpstellingData {
  readonly kaartvoorstelling: ImageData;
  readonly kaartvoorstellinggeselecteerd: ImageData;
}

interface Aanzicht {
  readonly anker: string;
  readonly hoek: number;
  readonly binaireData: BinaireAanzichtData;
}

interface BinaireAanzichtData {
  readonly platgeslagenvoorstelling: ImageData;
  readonly platgeslagenvoorstellinggeselecteerd: ImageData;
  readonly platgeslagenvoorstellingklein: ImageData;
  readonly platgeslagenvoorstellingkleingeselecteerd: ImageData;
}

interface ImageData {
  readonly properties: ImageDimensie;
  readonly mime: string;
  readonly data: base64;
}

interface ImageDimensie {
  readonly breedte: number;
  readonly hoogte: number;
}

type base64 = string;

function imageAanzicht(data: BinaireAanzichtData, geselecteerd: boolean, klein: boolean): ImageData {
  if (!geselecteerd && !klein) {
    return data.platgeslagenvoorstelling;
  } else if (geselecteerd && !klein) {
    return data.platgeslagenvoorstellinggeselecteerd;
  } else if (!geselecteerd && klein) {
    return data.platgeslagenvoorstellingklein;
  } else {
    return data.platgeslagenvoorstellingkleingeselecteerd;
  }
}

function imageOpstelling(data: BinaireOpstellingData, geselecteerd: boolean): ImageData {
  if (!geselecteerd) {
    return data.kaartvoorstelling;
  } else {
    return data.kaartvoorstellinggeselecteerd;
  }
}

function createIcon(iconData: base64, size: ol.Size, rotation: number, zetAnchor: boolean): ol.style.Icon {
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
  image.src = iconData;

  return new ol.style.Icon({
    img: image,
    imgSize: size,
    rotation: rotation,
    anchor: zetAnchor ? [0.5, 1] : [0.5, 0.5] // indien gezet, zet icon anchor midden onderaan bord, anders default in midden van icon
  });
}

function encodeAsSrc(mimeType: string, data: base64): string {
  return `data:${mimeType};base64,${data}`;
}

// They define their angles differently than normal geometry. 0 degrees is on top, and their angles increase
// clockwis instead of counterclockwise.
function transformeerHoek(hoek: number): number {
  return hoek ? -1 * hoek : 0;
}
