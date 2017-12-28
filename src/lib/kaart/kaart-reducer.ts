import { List } from "immutable";

import * as ol from "openlayers";

import { KaartConfig } from "./kaart.config";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";

export function kaartReducer(kaart: KaartWithInfo, cmd: prt.KaartEvnt): KaartWithInfo {
  console.log("kaart reducer", kaart, cmd);
  switch (cmd.type) {
    case prt.KaartEvntTypes.ADDED_LAAG_ON_TOP:
      return addLaagOnTop(kaart, (cmd as prt.AddedLaagOnTop).laag);
    case prt.KaartEvntTypes.REMOVED_LAAG:
      return removeLaag(kaart, (cmd as prt.RemovedLaag).titel);
    case prt.KaartEvntTypes.ADDED_SCHAAL:
      return addSchaal(kaart);
    case prt.KaartEvntTypes.REMOVED_SCHAAL:
      return removeSchaal(kaart);
    case prt.KaartEvntTypes.ADDED_STD_INT:
      return addStandaardInteracties(kaart);
    case prt.KaartEvntTypes.REMOVED_STD_INT:
      return removeStandaardInteracties(kaart);
    case prt.KaartEvntTypes.MIDDELPUNT_CHANGED:
      return updateMiddelpunt(kaart, (cmd as prt.MiddelpuntChanged).coordinate);
    case prt.KaartEvntTypes.ZOOM_CHANGED:
      return updateZoom(kaart, (cmd as prt.ZoomChanged).zoom);
    case prt.KaartEvntTypes.EXTENT_CHANGED:
      return updateExtent(kaart, (cmd as prt.ExtentChanged).extent);
    default:
      console.log("onverwacht commando", cmd);
      return kaart;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// de reducers hieronder zijn dus geen pure functies. Ze hebben allen een neveneffect op de openlayers map.
// de reden is dat enerzijds Map statefull is en anderzijds dat het niet triviaal is om een efficiente differ
// te maken op KaartWithInfo (en de object daarin) zodat we enkel de gepaste operaties op Map kunnen uitvoeren.

/**
 *  Toevoegen bovenaan de kaart.
 */
function addLaagOnTop(kaart: KaartWithInfo, laag: ke.Laag): KaartWithInfo {
  kaart.map.addLayer(toOlLayer(kaart.config, laag)); // Eikes!
  return { ...kaart, lagen: kaart.lagen.push(laag) };
}

/**
 * Een laag verwijderen. De titel van de laag bepaalt welke er verwijderd wordt.
 */
function removeLaag(kaart: KaartWithInfo, titel: string): KaartWithInfo {
  const teVerwijderen = kaart.lagen.findIndex(l => l.titel === titel);
  if (teVerwijderen >= 0) {
    const layers = kaart.map.getLayers();
    // we gaan er van uit dat de bovenste lagen achteraan staan bij ol
    kaart.map.removeLayer(layers[teVerwijderen]); // Eikes!
    return { ...kaart, lagen: kaart.lagen.delete(teVerwijderen) };
  } else {
    return kaart;
  }
}

function addSchaal(kaart: KaartWithInfo): KaartWithInfo {
  if (!kaart.schaal) {
    const schaal = new ol.control.ScaleLine();
    kaart.map.addControl(schaal);
    return { ...kaart, schaal: schaal }; // we zouden schalen kunnen tellen zodat we enkel de laatste effectief verwijderen
  } else {
    return kaart;
  }
}

function removeSchaal(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.schaal) {
    kaart.map.removeControl(kaart.schaal);
    return { ...kaart, schaal: null };
  } else {
    return kaart;
  }
}

function addStandaardInteracties(kaart: KaartWithInfo): KaartWithInfo {
  if (!kaart.stdInteracties || kaart.stdInteracties.isEmpty()) {
    const interacties = List(ol.interaction.defaults().getArray());
    interacties.forEach(i => kaart.map.addInteraction(i));
    return { ...kaart, stdInteracties: interacties };
  } else {
    return kaart;
  }
}

function removeStandaardInteracties(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.stdInteracties) {
    kaart.stdInteracties.forEach(i => kaart.map.removeInteraction(i));
    return { ...kaart, stdInteracties: null };
  } else {
    return kaart;
  }
}

function updateMiddelpunt(kaart: KaartWithInfo, coordinate: [number, number]): KaartWithInfo {
  kaart.map.getView().setCenter(coordinate);
  return { ...kaart, middelpunt: kaart.map.getView().getCenter(), extent: kaart.map.getView().calculateExtent(kaart.map.getSize()) };
}

function updateZoom(kaart: KaartWithInfo, zoom: number): KaartWithInfo {
  kaart.map.getView().setZoom(zoom);
  return { ...kaart, zoom: kaart.map.getView().getZoom(), extent: kaart.map.getView().calculateExtent(kaart.map.getSize()) };
}

function updateExtent(kaart: KaartWithInfo, extent: ol.Extent): KaartWithInfo {
  kaart.map.getView().fit(extent);
  return {
    ...kaart,
    middelpunt: kaart.map.getView().getCenter(),
    zoom: kaart.map.getView().getZoom(),
    extent: kaart.map.getView().calculateExtent(kaart.map.getSize())
  };
}

function toOlLayer(config: KaartConfig, laag: ke.Laag) {
  // we weten dat er maar 3 types zijn anders moeten we met option werken
  if (laag instanceof ke.WmsLaag) {
    const l = laag as ke.WmsLaag;
    return new ol.layer.Tile(<olx.layer.TileOptions>{
      title: l.titel,
      visible: true,
      extent: l.extent,
      source: new ol.source.TileWMS({
        projection: null,
        urls: l.urls.toArray(),
        params: {
          LAYERS: l.naam,
          TILED: true,
          SRS: config.srs,
          version: l.versie
        }
      })
    });
  } else if (laag instanceof ke.WdbLaag) {
    const l = laag as ke.WdbLaag;
    return new ol.layer.Tile(<olx.layer.TileOptions>{
      title: l.titel,
      visible: true,
      extent: l.extent,
      source: new ol.source.TileWMS({
        projection: null,
        urls: [l.url],
        params: {
          LAYERS: l.naam,
          TILED: true,
          SRS: config.srs,
          version: l.versie
        }
      })
    });
  } else {
    const l = laag as ke.VectorLaag;
    return new ol.layer.Vector(<olx.layer.VectorOptions>{
      title: l.titel,
      source: l.source,
      visible: true,
      style: l.style
    });
  }
}
