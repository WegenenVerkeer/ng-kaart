import { List, Map } from "immutable";
import { none, Option, some, fromNullable } from "fp-ts/lib/Option";
import * as validation from "fp-ts/lib/Validation";
import * as array from "fp-ts/lib/Array";
import { sequence } from "fp-ts/lib/Traversable";
import { monoidArray, getArrayMonoid } from "fp-ts/lib/Monoid";

import * as ol from "openlayers";

import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import * as res from "../api/Result";
import { KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";
import { toOlLayer } from "./laag-converter";
import { StyleSelector } from "./kaart-elementen";
import { forEach } from "../util/option";
import { Predicate } from "@angular/core";

///////////////////////////////////
// Hulpfuncties
//

// Dit type helpt om het updaten van het model iets minder repetitief te maken.
// type ModelUpdater = (kaart: KaartWithInfo) => KaartWithInfo;

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
  return doForLayer(titel, (layer: ol.layer.Layer) => (kaart: KaartWithInfo) => {
    kaart.map.removeLayer(layer); // Oesje. Side-effect. Gelukkig idempotent.
    pasZIndicesAan(-1, layer.getZIndex(), Number.MAX_SAFE_INTEGER, kaart); // Nog een side-effect.
    return {
      ...kaart,
      olLayersOpTitel: kaart.olLayersOpTitel.delete(titel),
      lagen: kaart.lagen.filterNot(l => l!.titel === titel).toList()
    };
  });
}

/**
 * Alle lagen in een gegeven bereik van z-indices aanpassen. Belangrijk om bij toevoegen, verwijderen en verplaatsen,
 * alle z-indices in een aangesloten interval te behouden.
 */
function pasZIndicesAan(aanpassing: number, vanaf: number, tot: number, kaart: KaartWithInfo) {
  kaart.olLayersOpTitel.forEach(layer => {
    const zIndex = layer!.getZIndex();
    if (zIndex >= vanaf && zIndex <= tot) {
      layer!.setZIndex(zIndex + aanpassing);
    }
  });
}

/**
 * Een laag onzichtbaar maken. De titel van de laag bepaalt welke er verborgen wordt.
 */
function hideLaag(titel: string): ModelUpdater {
  return doForLayer(titel, layer => {
    layer.setVisible(false);
    return keepModel; // We moeten die niet weten in het model (we leggen niet op dat er maar 1 tegelijk zichtbaar is)
  });
}

/**
 * Een laag zichtbaar maken. De titel van de laag bepaalt welke er getoond wordt.
 */
function showLaag(titel: string): ModelUpdater {
  return doForLayer(titel, layer => {
    layer.setVisible(true);
    return keepModel;
  });
}

function zetStijlVoorLaag(titel: string, stijl: StyleSelector) {
  return doForLayer(titel, layer => {
    asVectorLayer(layer).map(vectorlayer => vectorlayer.setStyle(stijl.type === "StaticStyle" ? stijl.style : stijl.styleFunction));
    return keepModel;
  });
}

const hideAchtergrond: ModelUpdater = withAchtergrondTitel(hideLaag);

const showAchtergrond: ModelUpdater = withAchtergrondTitel(showLaag);

function withAchtergrondTitel(f: (titel: string) => ModelUpdater): ModelUpdater {
  return (kaart: KaartWithInfo) => kaart.achtergrondlaagtitel.map(f).getOrElseValue(keepModel)(kaart);
}

function doForLayer(titel: string, updater: (layer: ol.layer.Base) => ModelUpdater): ModelUpdater {
  return (kaart: KaartWithInfo) => {
    const maybeLayerToUpdate: Option<ol.layer.Base> = fromNullable(kaart.olLayersOpTitel.get(titel));
    return maybeLayerToUpdate.fold(
      () => kaart, // een blanco laag bijv.
      layerToUpdate => updater(layerToUpdate)(kaart)
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
      pasZIndicesAan(1, effectivePosition, Number.MAX_SAFE_INTEGER, kaart);
      layer.setVisible(visible);
      layer.setZIndex(effectivePosition);
      kaart.map.addLayer(layer);
    });
    return updateModel({
      olLayersOpTitel: maybeLayer.map(layer => kaart.olLayersOpTitel.set(laag.titel, layer)).getOrElseValue(kaart.olLayersOpTitel),
      lagen: kaart.lagen.insert(effectivePosition, laag)
    })(kaart);
  };
}

function voegLaagToe(positie: number, laag: ke.Laag, visible: boolean): ModelUpdater {
  // De positie is absoluut (als er genoeg lagen zijn), maar niet noodzakelijk relatief als er al een laag met de titel bestond
  return andThen(verwijderLaag(laag.titel), insertLaagNoRemoveAt(positie, laag, visible));
}

function verplaatsLaag(titel: string, naarPositie: number): ModelUpdater {
  return (kaart: KaartWithInfo) => {
    return fromNullable(kaart.olLayersOpTitel.get(titel)).fold(
      () => kaart,
      layer => {
        const vanPositie = layer.getZIndex();
        // Afhankelijk of we van onder naar boven of van boven naar onder verschuiven, moeten de tussenliggende lagen
        // naar onder, resp. naar boven verschoven worden.
        pasZIndicesAan(Math.sign(vanPositie - naarPositie), Math.min(vanPositie, naarPositie), Math.max(vanPositie, naarPositie), kaart);
        layer.setZIndex(naarPositie);
        return kaart;
      }
    );
  };
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
  const maybeLayer = fromNullable(kaart.olLayersOpTitel.get(titel)).chain(asVectorLayer);
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
  return layer["setStyle"] ? some(layer as ol.layer.Vector) : none; // gebruik geen hasOwnProperty("getSource")! Geeft altijd false
}

const addNewBackgroundsToMap: ModelUpdater = (kaart: KaartWithInfo) => {
  return kaart.possibleBackgrounds.reduce((model, laag, index) => voegLaagToe(0, laag!, index === 0)(model!), kaart);
};

function setBackgrounds(
  backgrounds: List<ke.WmsLaag | ke.BlancoLaag>,
  geselecteerdeLaag: Option<ke.WmsLaag | ke.BlancoLaag>
): ModelUpdater {
  return updateModel({
    possibleBackgrounds: backgrounds,
    achtergrondlaagtitel: geselecteerdeLaag.fold(
      () => fromNullable(backgrounds.first()).map(bg => bg.titel), //
      laag => some(laag.titel)
    )
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
    case prt.KaartMessageTypes.VERPLAATS_LAAG:
      const verplaats = cmd as prt.VerplaatsLaag;
      return verplaatsLaag(verplaats.titel, verplaats.doelPositie)(kaart);
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
      forEach(kaart.achtergrondlaagtitelListener, listener => listener((cmd as prt.KiesAchtergrond).titel));
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
      const toonachtergrondkeuzeCmd = cmd as prt.ToonAchtergrondKeuze;
      return pipe(
        kaart,
        setBackgrounds(toonachtergrondkeuzeCmd.backgrounds, toonachtergrondkeuzeCmd.geselecteerdeLaag),
        addNewBackgroundsToMap,
        toonAchtergrondKeuze(true)
      );
    case prt.KaartMessageTypes.VERBERG_ACHTERGROND_KEUZE:
      return toonAchtergrondKeuze(false)(kaart); // moeten we alle lagen weer zichtbaar maken?
    case prt.KaartMessageTypes.MAAK_LAAG_ONZICHTBAAR:
      return hideLaag((cmd as prt.MaakLaagOnzichtbaar).titel)(kaart);
    case prt.KaartMessageTypes.MAAK_LAAG_ZICHTBAAR:
      return showLaag((cmd as prt.MaakLaagZichtbaar).titel)(kaart);
    case prt.KaartMessageTypes.ZET_STIJL_VOOR_LAAG:
      const cmdZetStijl = cmd as prt.ZetStijlVoorLaag;
      return zetStijlVoorLaag(cmdZetStijl.titel, cmdZetStijl.stijl)(kaart);
    default:
      // Gezien we compileren met --strictNullChecks, geeft de compiler een waarschuwing wanneer we een case zouden missen.
      // Helaas verhindert dat niet dat externe apps commando's kunnen sturen die (in de huidige versie) niet geïmplementeerd zijn.
      kaartLogger.warn("onverwacht commando", cmd);
      return keepModel(kaart);
  }
}

// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// experimental stuff
//

export type KaartCmdResult<Msg> = res.Result<string, Msg>;
export type KaartCmdValidation<T> = validation.Validation<string[], T>;

export interface ModelWithResult<Msg> {
  model: KaartWithInfo;
  result: KaartCmdResult<Msg>;
}

export type MsgConsumer<Msg> = prt.MessageConsumer<string, Msg>;

export type Model = KaartWithInfo;
export type ModelUpdater = (model: Model) => Model;
export type ModelConsumerResulter<Msg> = (model: Model, msgConsumer: MsgConsumer<Msg>) => Model;

export function kaartCmdReducer<Msg>(cmd: prt.Command<Msg>): ModelConsumerResulter<Msg> {
  return (model: KaartWithInfo, msgConsumer: MsgConsumer<Msg>) => {
    function ok(msg: Msg, newModel: Model): Model {
      msgConsumer(res.ok(msg));
      return newModel;
    }

    function fail(errorMsg: string, newModel: Model): Model {
      msgConsumer(res.err(errorMsg));
      return newModel;
    }

    function failMulti(errorMsgs: string[], newModel: Model): Model {
      errorMsgs.map(res.err).forEach(msgConsumer);
      return newModel;
    }

    function sendOk(msg: Msg): void {
      msgConsumer(res.ok(msg));
    }

    function checkFailure(failure: boolean, msg: string): KaartCmdResult<{}> {
      return failure ? res.err(msg) : res.ok({});
    }

    function checkFailureOrDo(failure: boolean, errorMsg: string, ifGood: () => [Msg, Model]): Model {
      if (failure) {
        msgConsumer(res.err(errorMsg));
        return model;
      } else {
        const [msg, newModel] = ifGood();
        msgConsumer(res.ok(msg));
        return newModel;
      }
    }

    const modelWithFail = (left: string) => fail(left, model); // TODO vervangen door functie hieronder
    const modelWithFails = (failureMsgs: string[]) => failMulti(failureMsgs, model);

    function toValidation(result: boolean, errMsg: string): KaartCmdValidation<any> {
      return result ? validation.failure(getArrayMonoid<string>())<{}>([errMsg]) : validation.success({});
    }

    /**
     * Een laag toevoegen. Faalt als er al een laag met die titel bestaat.
     */
    function voegLaagToeCmd(cmnd: prt.VoegLaagToeCmd<Msg>): Model {
      return valideerLayerBestaatNiet(cmnd.laag.titel).fold(
        modelWithFails, //
        () => insertLaagNoRemoveAtCmd(cmnd)
      );
    }

    /**
     * Een laag verwijderen. De titel van de laag bepaalt welke er verwijderd wordt.
     */
    function verwijderLaagCmd(cmnd: prt.VerwijderLaagCmd<Msg>): Model {
      return valideerLayerBestaat(cmnd.titel).fold(modelWithFails, layer => {
        model.map.removeLayer(layer); // Oesje. Side-effect. Gelukkig idempotent.
        pasZIndicesAan(-1, layer.getZIndex(), Number.MAX_SAFE_INTEGER, model); // Nog een side-effect.
        return ok(cmnd.wrapper(), {
          ...model,
          olLayersOpTitel: model.olLayersOpTitel.delete(cmnd.titel),
          lagen: model.lagen.filterNot(l => l!.titel === cmnd.titel).toList()
        });
      });
    }

    function verplaatsLaagCmd(cmnd: prt.VerplaatsLaagCmd<Msg>): Model {
      return valideerLayerBestaat(cmnd.titel).fold(
        // TODO mag ook geen achtergrondlaag zijn
        modelWithFails,
        layer => {
          const vanPositie = layer.getZIndex();
          const naarPositie = limitPosition(cmnd.naarPositie);
          // Afhankelijk of we van onder naar boven of van boven naar onder verschuiven, moeten de tussenliggende lagen
          // naar onder, resp. naar boven verschoven worden.
          pasZIndicesAan(Math.sign(vanPositie - naarPositie), Math.min(vanPositie, naarPositie), Math.max(vanPositie, naarPositie), model);
          layer.setZIndex(naarPositie);
          return ok(cmnd.wrapper(naarPositie), model);
        }
      );
    }

    function valideerLayerBestaat(titel: string): KaartCmdValidation<ol.layer.Base> {
      return validation.fromPredicate(getArrayMonoid<string>())(
        (l: ol.layer.Base) => l !== undefined,
        () => [`Een laag met titel ${titel} bestaat niet`]
      )(model.olLayersOpTitel.get(titel));
    }

    function valideerVectorLayerBestaat(titel: string): KaartCmdValidation<ol.layer.Vector> {
      return valideerLayerBestaat(titel).chain(
        layer =>
          layer["setStyle"]
            ? validation.success(layer as ol.layer.Vector)
            : validation.failure(getArrayMonoid<string>())([`De laag met titel ${titel} is geen vectorlaag`])
      );
    }

    function valideerLayerBestaatNiet(titel: string): KaartCmdValidation<{}> {
      return validation.fromPredicate(getArrayMonoid<string>())(
        (mdl: Model) => !mdl.olLayersOpTitel.has(titel),
        () => [`Een laag met titel ${titel} bestaat al`]
      )(model);
    }

    /**
     * Een laag invoegen op een bepaalde positie zonder er rekening mee te houden dat er al een laag met die titel bestaat.
     * Maw samen te gebruiker met verwijderLaag.
     * TODO: fout geven als layer niet aangemaakt kon worden.
     */
    function insertLaagNoRemoveAtCmd(cmnd: prt.VoegLaagToeCmd<Msg>): Model {
      const effectivePosition = limitPosition(cmnd.positie);
      const maybeLayer = toOlLayer(model, cmnd.laag);
      maybeLayer.map(layer => {
        pasZIndicesAan(1, effectivePosition, Number.MAX_SAFE_INTEGER, model);
        layer.setVisible(cmnd.magGetoondWorden);
        layer.setZIndex(effectivePosition);
        model.map.addLayer(layer);
      });
      return ok(cmnd.wrapper(effectivePosition), {
        ...model,
        olLayersOpTitel: maybeLayer.map(layer => model.olLayersOpTitel.set(cmnd.laag.titel, layer)).getOrElseValue(model.olLayersOpTitel),
        lagen: model.lagen.insert(effectivePosition, cmnd.laag)
      });
    }

    function addLaagToModel(layer: ol.layer.Base, laag: ke.Laag, mdl: Model): Model {
      return {
        ...model,
        olLayersOpTitel: model.olLayersOpTitel.set(laag.titel, layer),
        lagen: model.lagen.push(laag)
      };
    }

    function limitPosition(position: number) {
      return Math.max(1, Math.min(position, model.lagen.size - 1)); // 0 is voorbehouden voor achtergrondlagen
    }

    function voegSchaalToeCmd(cmnd: prt.VoegSchaalToeCmd<Msg>): Model {
      return model.schaal.fold(
        () => {
          const schaal = new ol.control.ScaleLine();
          model.map.addControl(schaal);
          return ok(cmnd.wrapper(), { ...model, schaal: some(schaal) });
        },
        () => fail("De schaal was al toegevoegd", model)
      );
    }

    function verwijderSchaalCmd(cmnd: prt.VerwijderSchaalCmd<Msg>): Model {
      return model.schaal.fold(
        () => fail("De schaal was nog niet toegevoegd", model),
        schaal => {
          model.map.removeControl(schaal);
          return ok(cmnd.wrapper(), { ...model, schaal: none });
        }
      );
    }

    function voegVolledigSchermToeCmd(cmnd: prt.VoegVolledigSchermToeCmd<Msg>): Model {
      return model.schaal.fold(
        () => {
          const fullScreen = new ol.control.FullScreen();
          model.map.addControl(fullScreen);
          return ok(cmnd.wrapper(), { ...model, fullScreen: some(fullScreen) });
        },
        () => fail("De volledig scherm knop was al toegevoegd", model)
      );
    }

    function verwijderVolledigSchermCmd(cmnd: prt.VerwijderVolledigSchermCmd<Msg>): Model {
      return model.schaal.fold(
        () => fail("De volledig scherm knop was nog niet toegevoegd", model),
        schaal => {
          model.map.removeControl(schaal);
          return ok(cmnd.wrapper(), { ...model, fullScreen: none });
        }
      );
    }

    function voegStandaardInteractiesToeCmd(cmnd: prt.VoegStandaardInteractiesToeCmd<Msg>): Model {
      return checkFailure(!model.stdInteracties.isEmpty(), "De standaard interacties zijn al ingesteld").fold(
        modelWithFail, //
        () => {
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
          interacties.forEach(i => model.map.addInteraction(i!)); // side effects :-(
          model.map.addInteraction(new ol.interaction.MouseWheelZoom({ constrainResolution: true })); // Geen fractionele resoluties!
          const newModel = { ...model, stdInteracties: interacties, scrollZoomOnFocus: cmnd.scrollZoomOnFocus };
          activateMouseWheelZoom(newModel, !cmnd.scrollZoomOnFocus); // TODO: zien of functie direct op interacties kunnen laten werken
          return ok(cmnd.wrapper(), newModel);
        }
      );
    }

    function verwijderStandaardInteractiesCmd(cmnd: prt.VerwijderStandaardInteractiesCmd<Msg>): Model {
      return checkFailure(model.stdInteracties.isEmpty(), "De standaard interacties zijn niet aanwezig").fold(
        modelWithFail, //
        () => {
          model.stdInteracties.forEach(i => model.map.removeInteraction(i!));
          return ok(cmnd.wrapper(), { ...model, stdInteracties: List<ol.interaction.Interaction>(), scrollZoomOnFocus: false });
        }
      );
    }

    function veranderMiddelpuntCmd(cmnd: prt.VeranderMiddelpuntCmd<Msg>): Model {
      model.map.getView().setCenter(cmnd.coordinate);
      return ok(cmnd.wrapper(), {
        ...model,
        middelpunt: some(model.map.getView().getCenter()),
        extent: some(model.map.getView().calculateExtent(model.map.getSize()))
      });
    }

    function veranderZoomniveauCmd(cmnd: prt.VeranderZoomCmd<Msg>): Model {
      model.map.getView().setZoom(cmnd.zoom);
      return ok(cmnd.wrapper(), model);
    }

    function veranderExtentCmd(cmnd: prt.VeranderExtentCmd<Msg>): Model {
      model.map.getView().fit(cmnd.extent);
      return ok(cmnd.wrapper(), {
        ...model,
        middelpunt: some(model.map.getView().getCenter()),
        zoom: model.map.getView().getZoom(),
        extent: some(model.map.getView().calculateExtent(model.map.getSize()))
      });
    }

    function veranderViewportCmd(cmnd: prt.VeranderViewportCmd<Msg>): Model {
      // eerst de container aanpassen of de kaart is uitgerekt
      if (cmnd.size[0]) {
        model.container.style.width = `${cmnd.size[0]}px`;
        model.container.parentElement.style.width = `${cmnd.size[0]}px`;
      }
      if (cmnd.size[1]) {
        model.container.style.height = `${cmnd.size[1]}px`;
        model.container.parentElement.style.height = `${cmnd.size[1]}px`;
      }
      model.map.setSize(cmnd.size);
      model.map.updateSize();
      return ok(cmnd.wrapper(), {
        ...model,
        size: some(model.map.getSize()),
        extent: some(model.map.getView().calculateExtent(model.map.getSize()))
      });
    }

    function focusOpKaartCmd(cmnd: prt.ZetFocusOpKaartCmd<Msg>): Model {
      if (model.scrollZoomOnFocus) {
        return activateMouseWheelZoomCmd(true);
      } else {
        return model;
      }
    }

    function verliesFocusOpKaartCmd(cmnd: prt.VerliesFocusOpKaartCmd<Msg>): Model {
      if (model.scrollZoomOnFocus) {
        return activateMouseWheelZoomCmd(false);
      } else {
        return model;
      }
    }

    function activateMouseWheelZoomCmd(active: boolean): Model {
      model.stdInteracties
        .filter(interaction => interaction instanceof ol.interaction.MouseWheelZoom)
        .forEach(interaction => interaction!.setActive(active));
      return model;
    }

    function vervangFeaturesCmd(cmnd: prt.VervangFeaturesCmd<Msg>): Model {
      return valideerVectorLayerBestaat(cmnd.titel).fold(modelWithFails, layer => {
        layer.getSource().clear(true);
        layer.getSource().addFeatures(cmnd.features.toArray());
        return ok(cmnd.wrapper(), model);
      });
    }

    function toonAchtergrondKeuzeCmd(cmnd: prt.ToonAchtergrondKeuzeCmd<Msg>): Model {
      const onbekendeTitels = cmnd.achtergrondTitels.filterNot(titel => model.olLayersOpTitel.has(titel!));
      const geselecteerdeTitelIsAchtergrondTitel = cmnd.geselecteerdeLaagTitel
        .map(t => cmnd.achtergrondTitels.contains(t))
        .getOrElseValue(false);

      return sequence(validation, array)([
        toValidation(model.showBackgroundSelector, "De achtergrondkeuze is al actief"),
        toValidation(onbekendeTitels.isEmpty(), `Er zijn geen lagen gedefinieerd met deze titels: [${onbekendeTitels.join()}]`),
        toValidation(cmnd.achtergrondTitels.isEmpty(), "Er moet minstens 1 achtergrondtitel zijn"),
        toValidation(geselecteerdeTitelIsAchtergrondTitel, "De titel van de geselecteerde laag is geen achtergrondlaag")
      ]).fold(
        modelWithFails, //
        () => {
          // Het idee is dat achtergrondlagen, lagen zijn die gewoon tussen de andere lagen tussen staan, maar dat
          // hun z-index allemaal op 0 staat (en die van de gewone lagen minstens op 1).
          const achtergrondLayers = cmnd.achtergrondTitels.map(titel => model.olLayersOpTitel.get(titel!));
          achtergrondLayers.forEach(layer => {
            pasZIndicesAan(-1, layer!.getZIndex() + 1, Number.MAX_SAFE_INTEGER, model);
            layer!.setZIndex(0);
            layer!.setVisible(false);
          });
          const teSelecterenTitel: string = cmnd.geselecteerdeLaagTitel.getOrElse(() => cmnd.achtergrondTitels.first());
          const achtergrondLayer = model.olLayersOpTitel.get(teSelecterenTitel);
          achtergrondLayer.setVisible(true);
          return ok(cmnd.wrapper(), { ...model, achtergrondLayer: some(achtergrondLayer), showBackgroundSelector: true });
        }
      );
    }

    function verbergAchtergrondKeuzeCmd(cmnd: prt.VerbergAchtergrondKeuzeCmd<Msg>): Model {
      return toValidation(!model.showBackgroundSelector, "De achtergrondkeuze is niet actief") //
        .fold(modelWithFails, () => ok(cmnd.wrapper(), { ...model, showBackgroundSelector: false }));
    }

    function kiesAchtergrondCmd(cmnd: prt.KiesAchtergrondCmd<Msg>): Model {
      return fromNullable(model.olLayersOpTitel.get(cmnd.titel)).fold(
        () => fail("Er is geen laag met deze titel", model),
        layer => {
          return toValidation(
            !model.possibleBackgrounds.some(l => !!l && l.titel === cmnd.titel),
            "De gekozen laag is geen achtergrond"
          ).fold(modelWithFails, () => {
            forEach(model.achtergrondlaagtitelListener, listener => listener(cmnd.titel));
            forEach(model.achtergrondLayer, l => l.setVisible(false));
            layer.setVisible(true);
            return ok(cmnd.wrapper(), { ...model, achtergrondLayer: some(layer) });
          });
        }
      );
    }

    function maakLaagZichtbaarCmd(cmnd: prt.MaakLaagZichtbaarCmd<Msg>): Model {
      return valideerLayerBestaat(cmnd.titel).fold(modelWithFails, layer => {
        layer.setVisible(true);
        return ok(cmnd.wrapper(), model);
      });
    }

    function maakLaagOnzichtbaarCmd(cmnd: prt.MaakLaagOnzichtbaarCmd<Msg>): Model {
      return valideerLayerBestaat(cmnd.titel).fold(modelWithFails, layer => {
        layer.setVisible(true);
        return ok(cmnd.wrapper(), model);
      });
    }

    function zetStijlVoorLaagCmd(cmnd: prt.ZetStijlVoorLaagCmd<Msg>): Model {
      return valideerVectorLayerBestaat(cmnd.titel).fold(modelWithFails, vectorlayer => {
        vectorlayer.setStyle(cmnd.stijl.type === "StaticStyle" ? cmnd.stijl.style : cmnd.stijl.styleFunction);
        return ok(cmnd.wrapper(), model);
      });
    }

    function handleSubscriptions(subCmd: prt.SubscriptionCmd<Msg>): Model {
      const map = model.map;

      function validateNotListening(listener: Option<any>, msg: string): KaartCmdResult<{}> {
        return checkFailure(listener.isSome(), msg);
      }

      function subscribeToZoom(sub: prt.ZoomNiveauSubscription<Msg>): Model {
        return validateNotListening(model.zoomniveauListener, "Er is al ingeschreven op het zoomniveau").fold(modelWithFail, () =>
          ok(subCmd.wrapper(), {
            ...model,
            zoomniveauListener: fromNullable(map
              .getView() //
              .on("change:resolution", event => sendOk(sub.wrapper(map.getView().getZoom()))) as ol.EventsKey)
          })
        );
      }

      function subscribeToZoombereik(sub: prt.ZoomBereikSubscription<Msg>): Model {
        return validateNotListening(model.zoombereikListener, "Er is al ingeschreven op het zoombereik").fold(modelWithFail, () =>
          ok(subCmd.wrapper(), {
            ...model,
            zoombereikListener: fromNullable(map
              .getView() //
              .on("change:length", event => sendOk(sub.wrapper(map.getView().getMinZoom(), map.getView().getMaxZoom()))) as ol.EventsKey)
          })
        );
      }

      function subscribeToMiddelpunt(sub: prt.MiddelpuntSubscription<Msg>): Model {
        return validateNotListening(model.middelpuntListener, "Er is al ingeschreven op het middelpunt").fold(modelWithFail, () =>
          ok(subCmd.wrapper(), {
            ...model,
            middelpuntListener: fromNullable(map
              .getView() //
              .on("change:center", event =>
                sendOk(sub.wrapper(map.getView().getCenter()[0], map.getView().getCenter()[1]))
              ) as ol.EventsKey)
          })
        );
      }

      function subscribeToAchtergrondTitel(sub: prt.AchtergrondTitelSubscription<Msg>): Model {
        return validateNotListening(model.achtergrondlaagtitelListener, "Er is al ingeschreven op het zoombereik").fold(modelWithFail, () =>
          ok(subCmd.wrapper(), {
            ...model,
            achtergrondlaagtitelListener: some((titel: string) => sendOk(sub.wrapper(titel)))
          })
        );
      }

      switch (subCmd.subscription.type) {
        case "Zoom":
          return subscribeToZoom(subCmd.subscription);
        case "Zoombereik":
          return subscribeToZoombereik(subCmd.subscription);
        case "Middelpunt":
          return subscribeToMiddelpunt(subCmd.subscription);
        case "Achtergrond":
          return subscribeToAchtergrondTitel(subCmd.subscription);
      }
    }

    function handleUnsubscriptions(cmnd: prt.UnsubscriptionCmd<Msg>): Model {
      const validateListening = (listener: Option<any>, msg: string) => checkFailure(listener.isNone(), msg);

      const unsubscribeFromZoom = () =>
        validateListening(model.zoomniveauListener, "Er is nog niet ingeschreven op het zoomniveau").fold(modelWithFail, () =>
          ok(cmnd.wrapper(), { ...model, zoomniveauListener: none })
        );

      const unsubscribeFromZoombereik = () =>
        validateListening(model.zoombereikListener, "Er is nog niet ingeschreven op het zoombereik").fold(modelWithFail, () =>
          ok(cmnd.wrapper(), { ...model, zoombereikListener: none })
        );

      const unsubscribeFromMiddelpunt = () =>
        validateListening(model.middelpuntListener, "Er is nog niet ingeschreven op het middelpunt").fold(modelWithFail, () =>
          ok(cmnd.wrapper(), { ...model, middelpuntListener: none })
        );

      const unsubscribeFromAchtergrondTitel = () =>
        validateListening(model.achtergrondlaagtitelListener, "Er is nog niet ingeschreven op de achtergrondtitel").fold(
          modelWithFail,
          () => ok(cmnd.wrapper(), { ...model, achtergrondlaagtitelListener: none })
        );

      switch (cmnd.subscriptionType) {
        case "Zoom":
          return unsubscribeFromZoom();
        case "Zoombereik":
          return unsubscribeFromZoombereik();
        case "Middelpunt":
          return unsubscribeFromMiddelpunt();
        case "Achtergrond":
          return unsubscribeFromAchtergrondTitel();
      }
    }

    switch (cmd.type) {
      case "VoegLaagToe":
        return voegLaagToeCmd(cmd);
      case "VerwijderLaag":
        return verwijderLaagCmd(cmd);
      case "VerplaatsLaag":
        return verplaatsLaagCmd(cmd);
      case "VoegSchaalToe":
        return voegSchaalToeCmd(cmd);
      case "VerwijderSchaal":
        return verwijderSchaalCmd(cmd);
      case "VoegVolledigSchermToe":
        return voegVolledigSchermToeCmd(cmd);
      case "VerwijderVolledigScherm":
        return verwijderVolledigSchermCmd(cmd);
      case "VoegStandaardInteractiesToe":
        return voegStandaardInteractiesToeCmd(cmd);
      case "VerwijderStandaardInteracties":
        return verwijderStandaardInteractiesCmd(cmd);
      case "VeranderMiddelpunt":
        return veranderMiddelpuntCmd(cmd);
      case "VeranderZoom":
        return veranderZoomniveauCmd(cmd);
      // zoomniveauveranderd & zoomminmax zouden we niet nodig moeten hebben
      case "VeranderExtent":
        return veranderExtentCmd(cmd);
      case "VeranderViewport":
        return veranderViewportCmd(cmd);
      case "FocusOpKaart":
        return focusOpKaartCmd(cmd);
      case "VerliesFocusOpKaart":
        return verliesFocusOpKaartCmd(cmd);
      case "VervangFeatures":
        return vervangFeaturesCmd(cmd);
      case "ToonAchtergrondKeuze":
        return toonAchtergrondKeuzeCmd(cmd);
      case "VerbergAchtergrondKeuze":
        return verbergAchtergrondKeuzeCmd(cmd);
      case "KiesAchtergrond":
        return kiesAchtergrondCmd(cmd);
      case "MaakLaagZichtbaar":
        return maakLaagZichtbaarCmd(cmd);
      case "MaakLaagOnzichtbaar":
        return maakLaagOnzichtbaarCmd(cmd);
      case "ZetStijlVoorLaag":
        return zetStijlVoorLaagCmd(cmd);
      case "Subscription":
        return handleSubscriptions(cmd);
      case "Unsubscription":
        return handleUnsubscriptions(cmd);
    }
  };
}
