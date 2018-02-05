import { List } from "immutable";
import { none, Option, some } from "fp-ts/lib/Option";

import * as ol from "openlayers";

import { KaartConfig } from "./kaart.config";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";

///////////////////////////////////
// Hulpfuncties
//

// Dit type helpt om het updaten van het model iets minder repetitief te maken.
type ModelUpdater = (kaart: KaartWithInfo) => KaartWithInfo;

/**
 * Functiecompositie waar f eerst uitgevoerd wordt en dan g.
 */
function andThen<A, B, C>(f: (a: A) => B, g: (b: B) => C) {
  return (a: A) => g(f(a));
}

/**
 * Functiecompositie van endofuncties.
 */
function chained<A>(...fs: ((a: A) => A)[]): (a: A) => A {
  return (a: A) => fs.reduce((acc, f) => f(acc), a);
}

function pipe<A>(a: A, ...fs: ((a: A) => A)[]): A {
  return chained(...fs)(a);
}

function updateModel(partial: Partial<KaartWithInfo>): ModelUpdater {
  return (model: KaartWithInfo) => ({ ...model, ...partial } as KaartWithInfo);
}

const keepModel: ModelUpdater = (model: KaartWithInfo) => model;

function guardedUpdate(pred: (kaart: KaartWithInfo) => boolean, updater: ModelUpdater): ModelUpdater {
  // return (model: KaartWithInfo) => (pred(model) ? updater(model) : model);
  return (model: KaartWithInfo) => {
    console.log("in guarded update", model, pred(model));
    return pred(model) ? updater(model) : model;
  };
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// de reducers hieronder zijn dus geen pure functies. Ze hebben bijna allen een neveneffect op de openlayers map.
// de reden is dat enerzijds Map statefull is en anderzijds dat het niet triviaal is om een efficiente differ
// te maken op KaartWithInfo (en de object daarin) zodat we enkel de gepaste operaties op Map kunnen uitvoeren.
// In principe zouden we dit moeten opsplitsen in transformaties naar het nieuwe model en interpretaties van dat
// model.
//

/**
 *  Toevoegen bovenaan de kaart. Als er al een laag was met dezelfde titel, dan wordt die eerst verwijderd.
 */
function addLaagOnTop(laag: ke.Laag): ModelUpdater {
  return insertLaag(Number.MAX_SAFE_INTEGER, laag, true);
}

/**
 * Een laag verwijderen. De titel van de laag bepaalt welke er verwijderd wordt.
 */
function removeLaag(titel: string): ModelUpdater {
  return doForLayer(titel, (kaart, layer) => {
    kaart.map.removeLayer(layer); // Oesje. Side-effect. Gelukkig idempotent.
    return updateModel({
      lagenOpTitel: kaart.lagenOpTitel.delete(titel),
      lagen: kaart.lagen.filterNot(l => l.titel === titel).toList()
    });
  });
}

/**
 * Een laag onzichtbaar maken. De titel van de laag bepaalt welke er verborgen wordt.
 */
function hideLaag(titel: string): ModelUpdater {
  return doForLayer(titel, (kaart, layer) => {
    layer.setVisible(false);
    return keepModel; // We moeten die niet weten in het model (we leggen niet op dat er maar 1 tegelijk zichtbaar is)
  });
}

/**
 * Een laag zichtbaar maken. De titel van de laag bepaalt welke er getoond wordt.
 */
function showLaag(titel: string): ModelUpdater {
  return doForLayer(titel, (kaart, layer) => {
    layer.setVisible(true);
    return keepModel;
  });
}

const hideAchtergrond: ModelUpdater = (kaart: KaartWithInfo) => hideLaag(kaart.achtergrondlaagtitel)(kaart);

const showAchtergrond: ModelUpdater = (kaart: KaartWithInfo) => showLaag(kaart.achtergrondlaagtitel)(kaart);

function doForLayer(titel: string, updater: (kaart: KaartWithInfo, layer: ol.layer.Base) => ModelUpdater): ModelUpdater {
  return (kaart: KaartWithInfo) => {
    const maybeLayerToUpdate: Option<ol.layer.Base> = kaart.lagenOpTitel.get(titel, none);
    return maybeLayerToUpdate.fold(
      () => kaart, // een blanco laag bijv.
      layerToUpdate => updater(kaart, layerToUpdate)(kaart)
    );
  };
}

/**
 * Een laag invoegen op een bepaalde positie zonder er rekening mee te houden dat er al een laag met die titel bestaat.
 * Maw samen te gebruiker met removeLaag.
 */
function insertLaagNoRemoveAt(positie: number, laag: ke.Laag, visible: boolean): ModelUpdater {
  return (kaart: KaartWithInfo) => {
    const effectivePosition = Math.max(0, Math.min(positie, kaart.lagen.size));
    const maybeLayer = toOlLayer(kaart, laag);
    maybeLayer.map(layer => {
      // In het geval van de blanco laag, hebben we geen openlayers layer
      layer.setVisible(visible);
      kaart.map.getLayers().insertAt(effectivePosition, layer);
    });
    return updateModel({
      lagenOpTitel: kaart.lagenOpTitel.set(laag.titel, maybeLayer),
      lagen: kaart.lagen.insert(effectivePosition, laag)
    })(kaart);
  };
}

function insertLaag(positie: number, laag: ke.Laag, visible: boolean): ModelUpdater {
  // De positie is absoluut (als er genoeg lagen zijn), maar niet noodzakelijk relatief als er al een laag met de titel bestond
  return andThen(removeLaag(laag.titel), insertLaagNoRemoveAt(positie, laag, visible));
}

const addSchaal: ModelUpdater = guardedUpdate(
  kaart => !kaart.schaal,
  kaart => {
    const schaal = new ol.control.ScaleLine();
    kaart.map.addControl(schaal);
    console.log("Added control", schaal);
    return updateModel({ schaal: schaal })(kaart);
  }
);

const removeSchaal: ModelUpdater = guardedUpdate(
  kaart => !!kaart.schaal,
  kaart => {
    kaart.map.removeControl(kaart.schaal);
    return { ...kaart, schaal: null };
  }
);

const addFullScreen: ModelUpdater = guardedUpdate(
  kaart => !kaart.fullScreen,
  kaart => {
    const fullScreen = new ol.control.FullScreen();
    kaart.map.addControl(fullScreen);
    console.log("Added control", fullScreen);
    return { ...kaart, fullScreen: fullScreen };
  }
);

const removeFullScreen: ModelUpdater = guardedUpdate(
  kaart => !!kaart.fullScreen,
  kaart => {
    kaart.map.removeControl(kaart.fullScreen);
    return { ...kaart, fullScreen: null };
  }
);

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

function updateViewport(size: ol.Size): ModelUpdater {
  return (kaart: KaartWithInfo) => {
    // eerst de container aanpassen of de kaart is uitgerekt
    if (size[0]) {
      kaart.container.style.width = `${size[0]}px`;
      kaart.container.parentElement.style.width = `${size[0]}px`;
    }
    if (size[1]) {
      kaart.container.style.height = `${size[1]}px`;
      kaart.container.parentElement.style.height = `${size[1]}px`;
    }
    kaart.map.setSize(size);
    kaart.map.updateSize();
    return {
      ...kaart,
      size: kaart.map.getSize(),
      extent: kaart.map.getView().calculateExtent(kaart.map.getSize())
    };
  };
}

function replaceFeatures(kaart: KaartWithInfo, titel: string, features: List<ol.Feature>): KaartWithInfo {
  const maybeLayer = kaart.lagenOpTitel.get(titel, none).chain(asVectorLayer);
  return maybeLayer.fold(
    () => kaart,
    layer => {
      layer.getSource().clear(true);
      layer.getSource().addFeatures(features.toArray());
      return kaart;
    }
  );
}

function asVectorLayer(layer: ol.layer.Base): Option<ol.layer.Vector> {
  return layer.hasOwnProperty("getSource") ? some(layer as ol.layer.Vector) : none;
}

function toOlLayer(kaart: KaartWithInfo, laag: ke.Laag): Option<ol.layer.Base> {
  switch (laag.type) {
    case ke.WmsType: {
      const l = laag as ke.WmsLaag;
      return some(
        new ol.layer.Tile(<olx.layer.TileOptions>{
          title: l.titel,
          visible: true,
          extent: l.extent,
          source: new ol.source.TileWMS({
            projection: null,
            urls: l.urls.toArray(),
            params: {
              LAYERS: l.naam,
              TILED: true,
              SRS: kaart.config.srs,
              version: l.versie
            }
          })
        })
      );
    }
    case ke.VectorType: {
      const l = laag as ke.VectorLaag;
      return some(
        new ol.layer.Vector({
          source: l.source,
          visible: true,
          style: l.style,
          minResolution: kaart.map.getView().getResolutions()[l.minZoom],
          maxResolution: kaart.map.getView().getResolutions()[l.maxZoom]
        })
      );
    }
    default:
      return none;
  }
}

const addNewBackgroundsToMap: ModelUpdater = (kaart: KaartWithInfo) => {
  return kaart.possibleBackgrounds.reduce((model, laag, index) => insertLaag(0, laag, index === 0)(model), kaart);
};

function setBackgrounds(backgrounds: List<ke.WmsLaag | ke.BlancoLaag>): ModelUpdater {
  return updateModel({ possibleBackgrounds: backgrounds, achtergrondlaagtitel: backgrounds.isEmpty() ? "" : backgrounds.get(0).titel });
}

function showBackgroundSelector(show: boolean): ModelUpdater {
  return updateModel({ showBackgroundSelector: show });
}

export function kaartReducer(kaart: KaartWithInfo, cmd: prt.KaartEvnt): KaartWithInfo {
  switch (cmd.type) {
    case prt.KaartEvntTypes.ADDED_LAAG_ON_TOP:
      return addLaagOnTop((cmd as prt.AddedLaagOnTop).laag)(kaart);
    case prt.KaartEvntTypes.REMOVED_LAAG:
      return removeLaag((cmd as prt.RemovedLaag).titel)(kaart);
    case prt.KaartEvntTypes.INSERTED_LAAG:
      const inserted = cmd as prt.InsertedLaag;
      return insertLaag(inserted.positie, inserted.laag, true)(kaart);
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
      return updateViewport((cmd as prt.ViewportChanged).size)(kaart);
    case prt.KaartEvntTypes.FOCUS_ON_MAP:
      return focusOnMap(kaart);
    case prt.KaartEvntTypes.LOSE_FOCUS_ON_MAP:
      return loseFocusOnMap(kaart);
    case prt.KaartEvntTypes.BG_SELECTED:
      return pipe(
        kaart, //
        hideAchtergrond,
        updateModel({ achtergrondlaagtitel: (cmd as prt.BackgroundSelected).titel }),
        showAchtergrond
      );
    case prt.KaartEvntTypes.SHOW_FEATURES:
      const replaceFeaturesEvent = cmd as prt.ReplaceFeatures;
      return replaceFeatures(kaart, replaceFeaturesEvent.titel, replaceFeaturesEvent.features);
    case prt.KaartEvntTypes.BG_SELECTOR_SHOWN:
      return pipe(
        kaart,
        setBackgrounds((cmd as prt.BackgroundSelectorShown).backgrounds),
        addNewBackgroundsToMap,
        showBackgroundSelector(true)
      );
    case prt.KaartEvntTypes.BG_SELECTOR_HIDDEN:
      return showBackgroundSelector(false)(kaart); // moeten we alle lagen weer zichtbaar maken?
    case prt.KaartEvntTypes.PROVIDED_LAAG: {
      const laag = (cmd as prt.ProvidedLaag).laag;
      return pipe(kaart, addLaagOnTop(laag), hideLaag(laag.titel));
    }
    default:
      kaartLogger.warn("onverwacht commando", cmd);
      return keepModel(kaart);
  }
}
