import { List } from "immutable";
import { none, Option, some, isNone } from "fp-ts/lib/Option";
import * as validation from "fp-ts/lib/Validation";
import * as array from "fp-ts/lib/Array";
import { sequence } from "fp-ts/lib/Traversable";
import { getArrayMonoid } from "fp-ts/lib/Monoid";

import * as ol from "openlayers";

import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";
import { toOlLayer } from "./laag-converter";
import { forEach } from "../util/option";
import { Subscription } from "rxjs";

///////////////////////////////////
// Hulpfuncties
//

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

function activateMouseWheelZoom(kaart: KaartWithInfo, active: boolean): KaartWithInfo {
  kaart.stdInteracties
    .filter(interaction => interaction instanceof ol.interaction.MouseWheelZoom)
    .forEach(interaction => interaction!.setActive(active));
  return kaart;
}

export type Model = KaartWithInfo;

export interface ModelWithResult<Msg> {
  model: KaartWithInfo;
  message: Option<Msg>;
}

function ModelWithResult<Msg>(model: Model, message: Option<Msg> = none): ModelWithResult<Msg> {
  return {
    model: model,
    message: message
  };
}

export function kaartCmdReducer<Msg extends prt.KaartMsg>(
  cmd: prt.Command<Msg>
): (model: Model, msgConsumer: prt.MessageConsumer<Msg>) => ModelWithResult<Msg> {
  return (model: Model, msgConsumer: prt.MessageConsumer<Msg>) => {
    interface KaartCmdResult<T> {
      model: Model;
      value: Option<T>;
    }

    function ModelAndValue<T>(mdl: Model, value: T): KaartCmdResult<T> {
      return {
        model: mdl,
        value: some(value)
      };
    }

    function ModelOnly(mdl: Model): KaartCmdResult<any> {
      return { model: mdl, value: none };
    }

    function toModelWithValueResult<T>(
      wrapper: prt.ValidationWrapper<T, Msg>,
      resultValidation: prt.KaartCmdValidation<KaartCmdResult<T>>
    ): ModelWithResult<Msg> {
      return {
        model: resultValidation.map(v => v.model).getOrElseValue(model),
        message: resultValidation.fold(
          // fail => some(wrapper(val.map(() => ({} as T)))), // we mogen de right wegmappen gezien we een left hebben
          fail => some(wrapper(validation.failure(getArrayMonoid<string>())(fail))),
          v => v.value.map(x => wrapper(success(x)))
        )
      };
    }

    // function toModelWithValueResult(
    //   wrapper: prt.BareValidationWrapper<Msg>,
    //   val: prt.KaartCmdValidation<ModelOnlyResult>
    // ): ModelWithResult<Msg> {
    //   return {
    //     model: val.map(v => v.model).getOrElseValue(model),
    //     message: some(wrapper(val.map(v => undefined))) // wis het model
    //   };
    // }

    const allOf = sequence(validation, array);
    const success = <T>(t: T) => validation.success<string[], T>(t);

    function fromOption<T>(maybe: Option<T>, errorMsg: string): prt.KaartCmdValidation<T> {
      return maybe.map(t => validation.success<string[], T>(t)).getOrElse(() => validation.failure(getArrayMonoid<string>())([errorMsg]));
    }

    function fromPredicate<T>(t: T, pred: (t: T) => boolean, errMsg: string): prt.KaartCmdValidation<T> {
      return validation.fromPredicate(getArrayMonoid<string>())(pred, () => [errMsg])(t);
    }

    function fromBoolean<T>(thruth: boolean, errMsg: string): prt.KaartCmdValidation<{}> {
      return thruth ? validation.success({}) : validation.failure(getArrayMonoid<string>())([errMsg]);
    }

    function valideerLayerBestaat(titel: string): prt.KaartCmdValidation<ol.layer.Base> {
      return validation.fromPredicate(getArrayMonoid<string>())(
        (l: ol.layer.Base) => l !== undefined,
        () => [`Een laag met titel ${titel} bestaat niet`]
      )(model.olLayersOpTitel.get(titel));
    }

    function valideerVectorLayerBestaat(titel: string): prt.KaartCmdValidation<ol.layer.Vector> {
      return valideerLayerBestaat(titel).chain(
        layer =>
          layer["setStyle"]
            ? validation.success(layer as ol.layer.Vector)
            : validation.failure(getArrayMonoid<string>())([`De laag met titel ${titel} is geen vectorlaag`])
      );
    }

    function valideerLayerBestaatNiet(titel: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(model, (mdl: Model) => !mdl.olLayersOpTitel.has(titel), `Een laag met titel ${titel} bestaat al`);
    }

    const valideerIsAchtergrondLaag: (layer: ol.layer.Base) => prt.KaartCmdValidation<ol.layer.Base> = (layer: ol.layer.Base) =>
      fromPredicate(layer, (layr: ol.layer.Base) => layr.getZIndex() === 0, "De laag is geen achtergrondlaag");

    const valideerIsGeenAchtergrondLaag: (layer: ol.layer.Base) => prt.KaartCmdValidation<ol.layer.Base> = (layer: ol.layer.Base) =>
      fromPredicate(layer, (layr: ol.layer.Base) => layr.getZIndex() !== 0, "De laag is een achtergrondlaag");

    const valideerAlsLayer: (laag: ke.Laag) => prt.KaartCmdValidation<ol.layer.Base> = (laag: ke.Laag) =>
      fromOption(toOlLayer(model, laag), "De laagbeschrijving kon niet naar een openlayers laag omgezet");

    const valideerAlsGeheel = (num: number) => fromPredicate(num, Number.isInteger, `'${num}' is geen geheel getal`);

    /**
     * Een laag toevoegen. Faalt als er al een laag met die titel bestaat.
     */
    function voegLaagToeCmd(cmnd: prt.VoegLaagToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaatNiet(cmnd.laag.titel).map(() => {
          const effectivePosition = limitPosition(cmnd.positie);
          const maybeLayer = toOlLayer(model, cmnd.laag); // TODO maak dit een validatie
          maybeLayer.map(layer => {
            pasZIndicesAan(1, effectivePosition, Number.MAX_SAFE_INTEGER, model);
            layer.setVisible(cmnd.magGetoondWorden);
            layer.setZIndex(effectivePosition);
            model.map.addLayer(layer);
          });
          return ModelAndValue(
            {
              ...model,
              olLayersOpTitel: maybeLayer
                .map(layer => model.olLayersOpTitel.set(cmnd.laag.titel, layer))
                .getOrElseValue(model.olLayersOpTitel),
              lagen: model.lagen.push(cmnd.laag)
            },
            effectivePosition
          );
        })
      );
    }

    /**
     * Een laag verwijderen. De titel van de laag bepaalt welke er verwijderd wordt.
     */
    function verwijderLaagCmd(cmnd: prt.VerwijderLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel).map(layer => {
          model.map.removeLayer(layer); // Oesje. Side-effect. Gelukkig idempotent.
          pasZIndicesAan(-1, layer.getZIndex(), Number.MAX_SAFE_INTEGER, model); // Nog een side-effect.
          return ModelOnly({
            ...model,
            olLayersOpTitel: model.olLayersOpTitel.delete(cmnd.titel),
            lagen: model.lagen.filterNot(l => l!.titel === cmnd.titel).toList()
          });
        })
      );
    }

    function verplaatsLaagCmd(cmnd: prt.VerplaatsLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel)
          .chain(valideerIsGeenAchtergrondLaag)
          .map(layer => {
            const vanPositie = layer.getZIndex();
            const naarPositie = limitPosition(cmnd.naarPositie);
            // Afhankelijk of we van onder naar boven of van boven naar onder verschuiven, moeten de tussenliggende lagen
            // naar onder, resp. naar boven verschoven worden.
            pasZIndicesAan(
              Math.sign(vanPositie - naarPositie),
              Math.min(vanPositie, naarPositie),
              Math.max(vanPositie, naarPositie),
              model
            );
            layer.setZIndex(naarPositie);
            return ModelAndValue(model, naarPositie);
          })
      );
    }

    function limitPosition(position: number) {
      // 0 is voorbehouden voor achtergrondlagen, dat wil zeggen dat voorgrondlagen vanaf 1 beginnen.
      // Achtergrondlagen beginnen hun leven als voorgrondlaag om dan later op z_index 0 gezet te worden.
      return 1 + Math.max(0, Math.min(position, model.lagen.size));
    }

    function voegSchaalToeCmd(cmnd: prt.VoegSchaalToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.schaal, isNone, "De schaal is al toegevoegd").map(() => {
          const schaal = new ol.control.ScaleLine();
          model.map.addControl(schaal);
          return ModelOnly({ ...model, schaal: some(schaal) });
        })
      );
    }

    function verwijderSchaalCmd(cmnd: prt.VerwijderSchaalCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromOption(model.schaal, "De schaal is nog niet toegevoegd").map((schaal: ol.control.Control) => {
          model.map.removeControl(schaal);
          return ModelOnly({ ...model, schaal: none });
        })
      );
    }

    function voegVolledigSchermToeCmd(cmnd: prt.VoegVolledigSchermToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.fullScreen, isNone, "De volledig scherm knop is al toegevoegd").map(() => {
          const fullScreen = new ol.control.FullScreen();
          model.map.addControl(fullScreen);
          return ModelOnly({ ...model, fullScreen: some(fullScreen) });
        })
      );
    }

    function verwijderVolledigSchermCmd(cmnd: prt.VerwijderVolledigSchermCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromOption(model.fullScreen, "De volledig scherm knop is nog niet toegevoegd").map((fullScreen: ol.control.Control) => {
          model.map.removeControl(fullScreen);
          return ModelOnly({ ...model, fullScreen: none });
        })
      );
    }

    function voegStandaardInteractiesToeCmd(cmnd: prt.VoegStandaardInteractiesToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.stdInteracties, l => l.isEmpty(), "De standaard interacties zijn al ingesteld").map(() => {
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
          const newModel: Model = { ...model, stdInteracties: interacties, scrollZoomOnFocus: cmnd.scrollZoomOnFocus };
          activateMouseWheelZoom(newModel, !cmnd.scrollZoomOnFocus); // TODO: zien of functie direct op interacties kunnen laten werken
          return ModelOnly(newModel);
        })
      );
    }

    function verwijderStandaardInteractiesCmd(cmnd: prt.VerwijderStandaardInteractiesCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.stdInteracties, l => !l.isEmpty(), "De standaard interacties zijn niet aanwezig").map(
          (stdInteracties: List<ol.interaction.Interaction>) => {
            stdInteracties.forEach(i => model.map.removeInteraction(i!));
            return ModelOnly({ ...model, fullScreen: none });
          }
        )
      );
    }

    function veranderMiddelpuntCmd(cmnd: prt.VeranderMiddelpuntCmd<Msg>): ModelWithResult<Msg> {
      model.map.getView().setCenter(cmnd.coordinate);
      return ModelWithResult({
        ...model,
        middelpunt: some(model.map.getView().getCenter()), // TODO hebben we dat echt nodig? Komt toch uit listener?
        extent: some(model.map.getView().calculateExtent(model.map.getSize())) // TODO idem (evt listener maken)
      });
    }

    function veranderZoomniveauCmd(cmnd: prt.VeranderZoomCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerAlsGeheel(cmnd.zoom).map(zoom => {
          model.map.getView().setZoom(cmnd.zoom);
          return ModelOnly(model);
        })
      );
    }

    function veranderExtentCmd(cmnd: prt.VeranderExtentCmd<Msg>): ModelWithResult<Msg> {
      model.map.getView().fit(cmnd.extent);
      return ModelWithResult({
        ...model,
        middelpunt: some(model.map.getView().getCenter()),
        zoom: model.map.getView().getZoom(),
        extent: some(model.map.getView().calculateExtent(model.map.getSize()))
      });
    }

    function veranderViewportCmd(cmnd: prt.VeranderViewportCmd<Msg>): ModelWithResult<Msg> {
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
      return ModelWithResult({
        ...model,
        size: some(model.map.getSize()),
        extent: some(model.map.getView().calculateExtent(model.map.getSize()))
      });
    }

    function focusOpKaartCmd(cmnd: prt.ZetFocusOpKaartCmd<Msg>): ModelWithResult<Msg> {
      activateMouseWheelZoomIfAllowed(true);
      return ModelWithResult(model);
    }

    function verliesFocusOpKaartCmd(cmnd: prt.VerliesFocusOpKaartCmd<Msg>): ModelWithResult<Msg> {
      activateMouseWheelZoomIfAllowed(false);
      return ModelWithResult(model);
    }

    function activateMouseWheelZoomIfAllowed(active: boolean): void {
      if (model.scrollZoomOnFocus) {
        model.stdInteracties
          .filter(interaction => interaction instanceof ol.interaction.MouseWheelZoom)
          .forEach(interaction => interaction!.setActive(active));
      }
    }

    function vervangFeaturesCmd(cmnd: prt.VervangFeaturesCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerVectorLayerBestaat(cmnd.titel).map(layer => {
          layer.getSource().clear(true);
          layer.getSource().addFeatures(cmnd.features.toArray());
          return ModelOnly(model);
        })
      );
    }

    function toonAchtergrondKeuzeCmd(cmnd: prt.ToonAchtergrondKeuzeCmd<Msg>): ModelWithResult<Msg> {
      const onbekendeTitels = cmnd.achtergrondTitels.filterNot(titel => model.olLayersOpTitel.has(titel!));
      const geselecteerdeTitelIsAchtergrondTitel = cmnd.geselecteerdeLaagTitel
        .map(t => cmnd.achtergrondTitels.contains(t))
        .getOrElseValue(true);

      return toModelWithValueResult(
        cmnd.wrapper,
        allOf([
          fromBoolean(!model.showBackgroundSelector, "De achtergrondkeuze is al actief"),
          fromBoolean(onbekendeTitels.isEmpty(), `Er zijn geen lagen gedefinieerd met deze titels: [${onbekendeTitels.join()}]`),
          fromBoolean(!cmnd.achtergrondTitels.isEmpty(), "Er moet minstens 1 achtergrondtitel zijn"),
          fromBoolean(geselecteerdeTitelIsAchtergrondTitel, "De titel van de geselecteerde laag is geen achtergrondlaag")
        ]).map(() => {
          // Het idee is dat achtergrondlagen, lagen zijn die gewoon tussen de andere lagen tussen staan, maar dat
          // hun z-index allemaal op 0 staat (en die van de gewone lagen minstens op 1).
          // Het is nu zo dat om een nieuwe achtergrondlaag toe te voegen wanneer de selector al zichtbaar gemaakt is,
          // dat de selector eerst verwijderd moet worden en dan weer toegevoegd. Dat is niet optimaal. Om dat op te
          // lossen kunnen we een extra VoegAchtergrondlaag commando toevoegen.
          const achtergrondLayers = cmnd.achtergrondTitels.map(titel => model.olLayersOpTitel.get(titel!));
          achtergrondLayers.forEach(layer => {
            pasZIndicesAan(-1, layer!.getZIndex() + 1, Number.MAX_SAFE_INTEGER, model);
            layer!.setZIndex(0);
            layer!.setVisible(false);
          });
          const teSelecterenTitel: string = cmnd.geselecteerdeLaagTitel.getOrElse(() => cmnd.achtergrondTitels.first());
          const achtergrondLayer = model.olLayersOpTitel.get(teSelecterenTitel);
          achtergrondLayer.setVisible(true);
          const achtergrondlagen = model.lagen.filter(l => cmnd.achtergrondTitels.contains(l!.titel)).toList();
          model.achtergrondlagenSubj.next(achtergrondlagen as List<ke.AchtergrondLaag>);
          model.achtergrondlaagtitelSubj.next(teSelecterenTitel);
          return ModelOnly({ ...model, achtergrondLayer: some(achtergrondLayer), showBackgroundSelector: true });
        })
      );
    }

    function verbergAchtergrondKeuzeCmd(cmnd: prt.VerbergAchtergrondKeuzeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromBoolean(model.showBackgroundSelector, "De achtergrondkeuze is niet actief") //
          .map(() => ModelOnly({ ...model, showBackgroundSelector: false }))
      );
    }

    function kiesAchtergrondCmd(cmnd: prt.KiesAchtergrondCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel)
          .chain(valideerIsAchtergrondLaag)
          .map(layer => {
            model.achtergrondlaagtitelSubj.next(cmnd.titel);
            forEach(model.achtergrondLayer, l => l.setVisible(false));
            layer.setVisible(true);
            return ModelOnly({ ...model, achtergrondLayer: some(layer) });
          })
      );
    }

    function maakLaagZichtbaarCmd(cmnd: prt.MaakLaagZichtbaarCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel).map(layer => {
          layer.setVisible(true);
          return ModelOnly(model);
        })
      );
    }

    function maakLaagOnzichtbaarCmd(cmnd: prt.MaakLaagOnzichtbaarCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel).map(layer => {
          layer.setVisible(true);
          return ModelOnly(model);
        })
      );
    }

    function zetStijlVoorLaagCmd(cmnd: prt.ZetStijlVoorLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerVectorLayerBestaat(cmnd.titel).map(vectorlayer => {
          vectorlayer.setStyle(cmnd.stijl.type === "StaticStyle" ? cmnd.stijl.style : cmnd.stijl.styleFunction);
          return ModelOnly(model);
        })
      );
    }

    function meldComponentFout(cmnd: prt.MeldComponentFoutCmd<Msg>): ModelWithResult<Msg> {
      model.componentFoutSubj.next(cmnd.fouten);
      return ModelWithResult(model);
    }

    function handleSubscriptions(cmnd: prt.SubscriptionCmd<Msg>): ModelWithResult<Msg> {
      const map = model.map;

      function subscribe(subscription: Subscription): ModelWithResult<Msg> {
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      function subscribeToZoominstellingen(sub: prt.ZoominstellingenSubscription<Msg>): ModelWithResult<Msg> {
        const subscription = model.zoominstellingenSubj.subscribe(z => msgConsumer(sub.wrapper(z)));
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      function subscribeToMiddelpunt(sub: prt.MiddelpuntSubscription<Msg>): ModelWithResult<Msg> {
        const subscription = model.middelpuntSubj.subscribe(m => msgConsumer(sub.wrapper(m[0], m[1])));
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      function subscribeToAchtergrondTitel(sub: prt.AchtergrondTitelSubscription<Msg>): ModelWithResult<Msg> {
        const subscription = model.achtergrondlaagtitelSubj.subscribe(t => msgConsumer(sub.wrapper(t)));
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      const subscribeToAchtergrondlagen = (wrapper: (achtergrondlagen: List<ke.AchtergrondLaag>) => Msg) =>
        subscribe(model.achtergrondlagenSubj.subscribe(l => msgConsumer(wrapper(l))));

      switch (cmnd.subscription.type) {
        case "Zoominstellingen":
          return subscribeToZoominstellingen(cmnd.subscription);
        case "Middelpunt":
          return subscribeToMiddelpunt(cmnd.subscription);
        case "Achtergrond":
          return subscribeToAchtergrondTitel(cmnd.subscription);
        case "Achtergrondlagen":
          return subscribeToAchtergrondlagen(cmnd.subscription.wrapper);
      }
    }

    function handleUnsubscriptions(cmnd: prt.UnsubscriptionCmd<Msg>): ModelWithResult<Msg> {
      cmnd.subscription.unsubscribe();
      return ModelWithResult(model);
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
      case "MeldComponentFout":
        return meldComponentFout(cmd);
    }
  };
}
