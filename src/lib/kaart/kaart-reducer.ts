import { List } from "immutable";
import { none, Option, some, fromNullable } from "fp-ts/lib/Option";

import * as ol from "openlayers";

import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";
import { toOlLayer } from "./laag-converter";

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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// de reducers hieronder zijn dus geen pure functies. Ze hebben bijna allen een neveneffect op de openlayers map.
// de reden is dat enerzijds Map statefull is en anderzijds dat het niet triviaal is om een efficiente differ
// te maken op KaartWithInfo (en de object daarin) zodat we enkel de gepaste operaties op Map kunnen uitvoeren.
// In principe zouden we dit moeten opsplitsen in transformaties naar het nieuwe model en interpretaties van dat
// model.
//

/**
 * Een laag verwijderen. De titel van de laag bepaalt welke er verwijderd wordt.
 */
function verwijderLaag(titel: string): ModelUpdater {
  return doForLayer(titel, (kaart, layer) => {
    kaart.map.removeLayer(layer); // Oesje. Side-effect. Gelukkig idempotent.
    return updateModel({
      lagenOpTitel: kaart.lagenOpTitel.delete(titel),
      lagen: kaart.lagen.filterNot(l => l!.titel === titel).toList()
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

const hideAchtergrond: ModelUpdater = withAchtergrondTitel(hideLaag);

const showAchtergrond: ModelUpdater = withAchtergrondTitel(showLaag);

function withAchtergrondTitel(f: (titel: string) => ModelUpdater): ModelUpdater {
  return (kaart: KaartWithInfo) => kaart.achtergrondlaagtitel.map(f).getOrElseValue(keepModel)(kaart);
}

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
 * Maw samen te gebruiker met verwijderLaag.
 */
function insertLaagNoRemoveAt(positie: number, laag: ke.Laag, visible: boolean): ModelUpdater {
  return (kaart: KaartWithInfo) => {
    const effectivePosition = Math.max(0, Math.min(positie, kaart.lagen.size));
    const maybeLayer = toOlLayer(kaart, laag);
    maybeLayer.map(layer => {
      layer.setVisible(visible);
      kaart.map.getLayers().insertAt(effectivePosition, layer);
    });
    return updateModel({
      lagenOpTitel: kaart.lagenOpTitel.set(laag.titel, maybeLayer),
      lagen: kaart.lagen.insert(effectivePosition, laag)
    })(kaart);
  };
}

function voegLaagToe(positie: number, laag: ke.Laag, visible: boolean): ModelUpdater {
  // De positie is absoluut (als er genoeg lagen zijn), maar niet noodzakelijk relatief als er al een laag met de titel bestond
  return andThen(verwijderLaag(laag.titel), insertLaagNoRemoveAt(positie, laag, visible));
}

// De volgende 4 functies zouden een stuk generieker kunnen met lenzen
const voegSchaalToe: ModelUpdater = (kaart: KaartWithInfo) =>
  kaart.schaal.fold(
    () => {
      const schaal = new ol.control.ScaleLine();
      kaart.map.addControl(schaal);
      return updateModel({ schaal: some(schaal) })(kaart);
    },
    () => keepModel(kaart)
  );

const verwijderSchaal: ModelUpdater = (kaart: KaartWithInfo) =>
  kaart.schaal.fold(
    () => kaart,
    schaal => {
      kaart.map.removeControl(schaal);
      return { ...kaart, schaal: none };
    }
  );

const voegVolledigschermToe: ModelUpdater = (kaart: KaartWithInfo) =>
  kaart.fullScreen.fold(
    () => {
      const fullScreen = new ol.control.FullScreen();
      kaart.map.addControl(fullScreen);
      return { ...kaart, fullScreen: some(fullScreen) };
    },
    () => keepModel(kaart)
  );

const verwijderVolledigscherm: ModelUpdater = (kaart: KaartWithInfo) =>
  kaart.fullScreen.fold(
    () => kaart,
    fullScreen => {
      kaart.map.removeControl(fullScreen);
      return { ...kaart, fullScreen: none };
    }
  );

function voegStandaardinteractiesToe(kaart: KaartWithInfo, scrollZoomOnFocus: boolean): KaartWithInfo {
  if (!kaart.stdInteracties || kaart.stdInteracties.isEmpty()) {
    // We willen standaard geen rotate operaties.
    const stdInteracties: ol.interaction.Interaction[] = ol.interaction
      .defaults()
      .getArray()
      .filter(
        interaction =>
          !(
            interaction instanceof ol.interaction.DragRotate ||
            interaction instanceof ol.interaction.PinchRotate ||
            interaction instanceof ol.interaction.MouseWheelZoom
          ) // we willen zelf de opties op MouseWheelZoom zetten
      );

    const interacties: List<ol.interaction.Interaction> = List<ol.interaction.Interaction>(stdInteracties);
    interacties.forEach(i => kaart.map.addInteraction(i!)); // side effects :-(
    kaart.map.addInteraction(new ol.interaction.MouseWheelZoom({ constrainResolution: true })); // Geen fractionele resoluties!
    const newKaart = { ...kaart, stdInteracties: interacties, scrollZoomOnFocus: scrollZoomOnFocus };
    return activateMouseWheelZoom(newKaart, !scrollZoomOnFocus);
  } else {
    return kaart;
  }
}

function verwijderStandaardinteracties(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.stdInteracties) {
    kaart.stdInteracties.forEach(i => kaart.map.removeInteraction(i!));
    return { ...kaart, stdInteracties: List<ol.interaction.Interaction>(), scrollZoomOnFocus: false };
  } else {
    return kaart;
  }
}

function focusOpKaart(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.scrollZoomOnFocus) {
    return activateMouseWheelZoom(kaart, true);
  } else {
    return kaart;
  }
}

function verliesFocusOpKaart(kaart: KaartWithInfo): KaartWithInfo {
  if (kaart.scrollZoomOnFocus) {
    return activateMouseWheelZoom(kaart, false);
  } else {
    return kaart;
  }
}

function activateMouseWheelZoom(kaart: KaartWithInfo, active: boolean): KaartWithInfo {
  kaart.stdInteracties
    .filter(interaction => interaction instanceof ol.interaction.MouseWheelZoom)
    .forEach(interaction => interaction!.setActive(active));
  return kaart;
}

function veranderMiddelpunt(kaart: KaartWithInfo, coordinate: [number, number]): KaartWithInfo {
  kaart.map.getView().setCenter(coordinate);
  return {
    ...kaart,
    middelpunt: some(kaart.map.getView().getCenter()),
    extent: some(kaart.map.getView().calculateExtent(kaart.map.getSize()))
  };
}

function handelFoutAf(kaart: KaartWithInfo, fout: string): KaartWithInfo {
  return {
    ...kaart,
    fout: some(fout)
  };
}

function veranderZoomniveau(kaart: KaartWithInfo, zoom: number): KaartWithInfo {
  kaart.map.getView().setZoom(zoom);
  return kaart;
}

function zoomniveauVeranderd(kaart: KaartWithInfo, zoom: number): KaartWithInfo {
  return {
    ...kaart,
    zoom: kaart.map.getView().getZoom(),
    extent: some(kaart.map.getView().calculateExtent(kaart.map.getSize()))
  };
}

function zoomminmaxVeranderd(kaart: KaartWithInfo, minZoom: number, maxZoom: number): KaartWithInfo {
  return {
    ...kaart,
    minZoom: minZoom,
    maxZoom: maxZoom
  };
}

function veranderExtent(kaart: KaartWithInfo, extent: ol.Extent): KaartWithInfo {
  kaart.map.getView().fit(extent);
  return {
    ...kaart,
    middelpunt: some(kaart.map.getView().getCenter()),
    zoom: kaart.map.getView().getZoom(),
    extent: some(kaart.map.getView().calculateExtent(kaart.map.getSize()))
  };
}

function veranderViewport(size: ol.Size): ModelUpdater {
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
      size: some(kaart.map.getSize()),
      extent: some(kaart.map.getView().calculateExtent(kaart.map.getSize()))
    };
  };
}

function vervangFeatures(kaart: KaartWithInfo, titel: string, features: List<ol.Feature>): KaartWithInfo {
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
  return layer["getSource"] ? some(layer as ol.layer.Vector) : none; // gebruik geen hasOwnProperty("getSource")! Geeft altijd false
}

const addNewBackgroundsToMap: ModelUpdater = (kaart: KaartWithInfo) => {
  return kaart.possibleBackgrounds.reduce((model, laag, index) => voegLaagToe(0, laag!, index === 0)(model!), kaart);
};

function setBackgrounds(backgrounds: List<ke.WmsLaag | ke.BlancoLaag>): ModelUpdater {
  return updateModel({
    possibleBackgrounds: backgrounds,
    achtergrondlaagtitel: fromNullable(backgrounds.first()).map(bg => bg.titel)
  });
}

function toonAchtergrondKeuze(show: boolean): ModelUpdater {
  return updateModel({ showBackgroundSelector: show });
}

export function kaartReducer(kaart: KaartWithInfo, cmd: prt.KaartMessage): KaartWithInfo {
  switch (cmd.type) {
    case prt.KaartMessageTypes.VERWIJDER_LAAG:
      return verwijderLaag((cmd as prt.VerwijderLaag).titel)(kaart);
    case prt.KaartMessageTypes.VOEG_LAAG_TOE:
      const inserted = cmd as prt.VoegLaagToe;
      return voegLaagToe(inserted.positie, inserted.laag, inserted.magGetoondWorden)(kaart);
    case prt.KaartMessageTypes.VOEG_SCHAAL_TOE:
      return voegSchaalToe(kaart);
    case prt.KaartMessageTypes.VERWIJDER_SCHAAL:
      return verwijderSchaal(kaart);
    case prt.KaartMessageTypes.VOEG_VOLLEDIGSCHERM_TOE:
      return voegVolledigschermToe(kaart);
    case prt.KaartMessageTypes.VERWIJDER_VOLLEDIGSCHERM:
      return verwijderVolledigscherm(kaart);
    case prt.KaartMessageTypes.VOEG_STANDAARDINTERACTIES_TOE:
      return voegStandaardinteractiesToe(kaart, (cmd as prt.VoegStandaardinteractiesToe).scrollZoomOnFocus);
    case prt.KaartMessageTypes.VERWIJDER_STANDAARDINTERACTIES:
      return verwijderStandaardinteracties(kaart);
    case prt.KaartMessageTypes.VERANDER_MIDDELPUNT:
      return veranderMiddelpunt(kaart, (cmd as prt.VeranderMiddelpunt).coordinate);
    case prt.KaartMessageTypes.VERANDER_ZOOMNIVEAU:
      return veranderZoomniveau(kaart, (cmd as prt.VeranderZoomniveau).zoom);
    case prt.KaartMessageTypes.ZOOMNIVEAU_VERANDERD:
      return zoomniveauVeranderd(kaart, (cmd as prt.ZoomniveauVeranderd).zoom);
    case prt.KaartMessageTypes.ZOOMMINMAX_VERANDERD:
      const zoomMinMax = cmd as prt.ZoomminmaxVeranderd;
      return zoomminmaxVeranderd(kaart, zoomMinMax.minZoom, zoomMinMax.maxZoom);
    case prt.KaartMessageTypes.VERANDER_EXTENT:
      return veranderExtent(kaart, (cmd as prt.VeranderExtent).extent);
    case prt.KaartMessageTypes.VERANDER_VIEWPORT:
      return veranderViewport((cmd as prt.VeranderViewport).size)(kaart);
    case prt.KaartMessageTypes.FOCUS_OP_KAART:
      return focusOpKaart(kaart);
    case prt.KaartMessageTypes.VERLIES_FOCUS_OP_KAART:
      return verliesFocusOpKaart(kaart);
    case prt.KaartMessageTypes.KIES_ACHTERGROND:
      return pipe(
        kaart, //
        hideAchtergrond,
        updateModel({ achtergrondlaagtitel: some((cmd as prt.KiesAchtergrond).titel) }),
        showAchtergrond
      );
    case prt.KaartMessageTypes.VERVANG_FEATURES:
      const vervangFeaturesEvent = cmd as prt.VervangFeatures;
      return vervangFeatures(kaart, vervangFeaturesEvent.titel, vervangFeaturesEvent.features);
    case prt.KaartMessageTypes.TOON_ACHTERGROND_KEUZE:
      return pipe(kaart, setBackgrounds((cmd as prt.ToonAchtergrondKeuze).backgrounds), addNewBackgroundsToMap, toonAchtergrondKeuze(true));
    case prt.KaartMessageTypes.VERBERG_ACHTERGROND_KEUZE:
      return toonAchtergrondKeuze(false)(kaart); // moeten we alle lagen weer zichtbaar maken?
    case prt.KaartMessageTypes.MAAK_LAAG_ONZICHTBAAR:
      return hideLaag((cmd as prt.MaakLaagOnzichtbaar).titel)(kaart);
    case prt.KaartMessageTypes.MAAK_LAAG_ZICHTBAAR:
      return showLaag((cmd as prt.MaakLaagZichtbaar).titel)(kaart);
    case prt.KaartMessageTypes.FOUT_GEBEURD:
      return handelFoutAf(kaart, (cmd as prt.FoutGebeurd).fout);
    default:
      kaartLogger.warn("onverwacht commando", cmd);
      return keepModel(kaart);
  }
}
