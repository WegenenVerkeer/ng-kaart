import { List } from "immutable";

import * as ol from "openlayers";

import { KaartConfig } from "./kaart.config";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";

export function kaartReducer(kaart: KaartWithInfo, cmd: prt.KaartEvnt): KaartWithInfo {
  kaartLogger.debug("kaart reducer", cmd);
  switch (cmd.type) {
    case prt.KaartEvntTypes.ADDED_LAAG_ON_TOP:
      return addLaagOnTop(kaart, (cmd as prt.AddedLaagOnTop).laag);
    case prt.KaartEvntTypes.REMOVED_LAAG:
      return removeLaag(kaart, (cmd as prt.RemovedLaag).titel);
    case prt.KaartEvntTypes.INSERTED_LAAG:
      const inserted = cmd as prt.InsertedLaag;
      return insertLaag(kaart, inserted.positie, inserted.laag);
    case prt.KaartEvntTypes.ADDED_SCHAAL:
      return addSchaal(kaart);
    case prt.KaartEvntTypes.REMOVED_SCHAAL:
      return removeSchaal(kaart);
    case prt.KaartEvntTypes.ADDED_FULL_SCREEN:
      return addFullScreen(kaart);
    case prt.KaartEvntTypes.REMOVED_FULL_SCREEN:
      return removeFullScreen(kaart);
    case prt.KaartEvntTypes.ADDED_STD_INT:
      return addStandaardInteracties(kaart, (cmd as prt.AddedStandaardInteracties).scrollZoomOnFocus);
    case prt.KaartEvntTypes.REMOVED_STD_INT:
      return removeStandaardInteracties(kaart);
    case prt.KaartEvntTypes.MIDDELPUNT_CHANGED:
      return updateMiddelpunt(kaart, (cmd as prt.MiddelpuntChanged).coordinate);
    case prt.KaartEvntTypes.ZOOM_CHANGED:
      return updateZoom(kaart, (cmd as prt.ZoomChanged).zoom);
    case prt.KaartEvntTypes.EXTENT_CHANGED:
      return updateExtent(kaart, (cmd as prt.ExtentChanged).extent);
    case prt.KaartEvntTypes.VIEWPORT_CHANGED:
      return updateViewport(kaart, (cmd as prt.ViewportChanged).size);
    case prt.KaartEvntTypes.FOCUS_ON_MAP:
      return focusOnMap(kaart);
    case prt.KaartEvntTypes.LOSE_FOCUS_ON_MAP:
      return loseFocusOnMap(kaart);
    case prt.KaartEvntTypes.SHOW_FEATURES:
      const replaceFeaturesEvent = cmd as prt.ReplaceFeatures;
      return replaceFeatures(kaart, replaceFeaturesEvent.titel, replaceFeaturesEvent.features);
    default:
      kaartLogger.warn("onverwacht commando", cmd);
      return kaart;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// de reducers hieronder zijn dus geen pure functies. Ze hebben allen een neveneffect op de openlayers map.
// de reden is dat enerzijds Map statefull is en anderzijds dat het niet triviaal is om een efficiente differ
// te maken op KaartWithInfo (en de object daarin) zodat we enkel de gepaste operaties op Map kunnen uitvoeren.
// In principe zouden we dit moeten opsplitsen in transformaties naar het nieuwe model en interpretaties van dat
// model.

/**
 *  Toevoegen bovenaan de kaart. Als er al een laag was met dezelfde titel, dan wordt die eerst verwijderd.
 */
function addLaagOnTop(kaart: KaartWithInfo, laag: ke.Laag): KaartWithInfo {
  // is er een state monad voor TS?
  const kaartNaVerwijdering = removeLaag(kaart, laag.titel);
  const layer = toOlLayer(kaartNaVerwijdering.config, laag);
  kaartNaVerwijdering.map.addLayer(layer);
  return { ...kaartNaVerwijdering, lagenOpTitel: kaartNaVerwijdering.lagenOpTitel.set(laag.titel, layer) };
}

/**
 * Een laag verwijderen. De titel van de laag bepaalt welke er verwijderd wordt.
 */
function removeLaag(kaart: KaartWithInfo, titel: string): KaartWithInfo {
  const teVerwijderen = kaart.lagenOpTitel.get(titel);
  if (teVerwijderen) {
    kaart.map.removeLayer(teVerwijderen);
    return { ...kaart, lagenOpTitel: kaart.lagenOpTitel.delete(titel) };
  } else {
    return kaart;
  }
}

function insertLaag(kaart: KaartWithInfo, positie: number, laag: ke.Laag) {
  const kaartNaVerwijdering = removeLaag(kaart, laag.titel);
  const layer = toOlLayer(kaartNaVerwijdering.config, laag);
  const layers = kaartNaVerwijdering.map.getLayers();
  layers.insertAt(0, layer);
  return { ...kaartNaVerwijdering, lagenOpTitel: kaartNaVerwijdering.lagenOpTitel.set(laag.titel, layer) };
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

function addFullScreen(kaart: KaartWithInfo): KaartWithInfo {
  if (!kaart.fullScreen) {
    const fullScreen = new ol.control.FullScreen();
    kaart.map.addControl(fullScreen);
    return { ...kaart, fullScreen: fullScreen };
  } else {
    return kaart;
  }
}

function removeFullScreen(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.fullScreen) {
    kaart.map.removeControl(kaart.fullScreen);
    return { ...kaart, fullScreen: null };
  } else {
    return kaart;
  }
}

function addStandaardInteracties(kaart: KaartWithInfo, scrollZoomOnFocus: boolean): KaartWithInfo {
  if (!kaart.stdInteracties || kaart.stdInteracties.isEmpty()) {
    const interacties = List(ol.interaction.defaults().getArray());
    interacties.forEach(i => kaart.map.addInteraction(i)); // side effects :-(
    const newKaart = { ...kaart, stdInteracties: interacties, scrollZoomOnFocus: scrollZoomOnFocus };
    return activateMouseWheelZoom(newKaart, !scrollZoomOnFocus);
  } else {
    return kaart;
  }
}

function removeStandaardInteracties(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.stdInteracties) {
    kaart.stdInteracties.forEach(i => kaart.map.removeInteraction(i));
    return { ...kaart, stdInteracties: null, scrollZoomOnFocus: false };
  } else {
    return kaart;
  }
}

function focusOnMap(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.scrollZoomOnFocus) {
    return activateMouseWheelZoom(kaart, true);
  } else {
    return kaart;
  }
}

function loseFocusOnMap(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.scrollZoomOnFocus) {
    return activateMouseWheelZoom(kaart, false);
  } else {
    return kaart;
  }
}

function activateMouseWheelZoom(kaart: KaartWithInfo, active: boolean): KaartWithInfo {
  kaart.stdInteracties
    .filter(interaction => interaction instanceof ol.interaction.MouseWheelZoom)
    .forEach(interaction => interaction.setActive(active));
  return kaart;
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

function updateViewport(kaart: KaartWithInfo, size: ol.Size): KaartWithInfo {
  // eerst de container aanpassen of de kaart is uitgerekt
  if (size[0]) {
    kaart.container.style.width = `${size[0]}px`;
  }
  if (size[1]) {
    kaart.container.style.height = `${size[1]}px`;
  }
  kaart.map.setSize(size);
  kaart.map.updateSize();
  return {
    ...kaart,
    size: kaart.map.getSize(),
    extent: kaart.map.getView().calculateExtent(kaart.map.getSize())
  };
}

function replaceFeatures(kaart: KaartWithInfo, titel: string, features: List<ol.Feature>): KaartWithInfo {
  const laag = <ol.layer.Vector>kaart.lagenOpTitel.get(titel);
  if (laag && laag.getSource) {
    laag.getSource().clear(true);
    laag.getSource().addFeatures(features.toArray());
  }
  return kaart;
}

function toOlLayer(config: KaartConfig, laag: ke.Laag) {
  switch (laag.type) {
    case ke.ElementType.WMSLAAG: {
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
    }
    case ke.ElementType.VECTORLAAG: {
      const l = laag as ke.VectorLaag;
      return new ol.layer.Vector(<olx.layer.VectorOptions>{
        title: l.titel,
        source: l.source,
        visible: true,
        style: l.style
      });
    }
  }
}
