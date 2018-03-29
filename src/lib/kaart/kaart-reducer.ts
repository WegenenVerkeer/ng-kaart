import { List } from "immutable";
import { none, Option, some, isNone, fromNullable } from "fp-ts/lib/Option";
import * as validation from "fp-ts/lib/Validation";
import * as array from "fp-ts/lib/Array";
import { sequence } from "fp-ts/lib/Traversable";
import { getArrayMonoid } from "fp-ts/lib/Monoid";

import * as ol from "openlayers";

import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { toOlLayer } from "./laag-converter";
import { forEach } from "../util/option";
import { Subscription } from "rxjs";
import { debounceTime, filter } from "rxjs/operators";
import { Laaggroep, PositieAanpassing } from "./kaart-protocol-commands";

///////////////////////////////////
// Hulpfuncties
//

export type Model = KaartWithInfo;

export interface ModelWithResult<Msg> {
  model: KaartWithInfo;
  message: Option<Msg>;
}

const AchtergrondIndex = 0;
const VoorgrondIndexStart = 1;
const ToolIndex = 1000000;

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

    function ModelAndEmptyResult(mdl: Model): KaartCmdResult<any> {
      return {
        model: mdl,
        value: some({})
      };
    }

    function toModelWithValueResult<T>(
      wrapper: prt.ValidationWrapper<T, Msg>,
      resultValidation: prt.KaartCmdValidation<KaartCmdResult<T>>
    ): ModelWithResult<Msg> {
      return {
        model: resultValidation.map(v => v.model).getOrElseValue(model),
        message: resultValidation.fold(
          fail => some(wrapper(validation.failure(getArrayMonoid<string>())(fail))),
          v => v.value.map(x => wrapper(success(x)))
        )
      };
    }

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

    function valideerLaagTitelBestaatNiet(titel: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(model, (mdl: Model) => !mdl.olLayersOpTitel.has(titel), `Een laag met titel ${titel} bestaat al`);
    }

    const valideerIsAchtergrondLaag: (titel: string) => prt.KaartCmdValidation<{}> = (titel: string) =>
      fromBoolean(model.groepOpTitel.get(titel) === "Achtergrond", "De laag is geen achtergrondlaag");

    const valideerIsVoorgrondlaag: (layer: ol.layer.Base) => prt.KaartCmdValidation<ol.layer.Base> = (layer: ol.layer.Base) =>
      fromPredicate(layer, (layr: ol.layer.Base) => layerNaarLaaggroep(layr) === "Voorgrond", "De laag is geen voorgrondlaag");

    const valideerAlsLayer: (laag: ke.Laag) => prt.KaartCmdValidation<ol.layer.Base> = (laag: ke.Laag) =>
      fromOption(toOlLayer(model, laag), "De laagbeschrijving kon niet naar een openlayers laag omgezet");

    const valideerAlsGeheel = (num: number) => fromPredicate(num, Number.isInteger, `'${num}' is geen geheel getal`);

    /**
     * Alle lagen in een gegeven bereik van z-indices aanpassen. Belangrijk om bij toevoegen, verwijderen en verplaatsen,
     * alle z-indices in een aangesloten interval te behouden.
     */
    function pasZIndicesAan(aanpassing: number, vanaf: number, tot: number, groep: Laaggroep): List<PositieAanpassing> {
      return model.olLayersOpTitel.reduce((updates, layer, titel) => {
        const groepPositie = layerIndexNaarGroepIndex(layer!, groep);
        if (groepPositie >= vanaf && groepPositie <= tot) {
          const positie = groepPositie + aanpassing;
          zetLayerIndex(layer!, positie, groep);
          return updates!.push({ titel: titel!, positie: positie });
        } else {
          return updates!;
        }
      }, List<prt.PositieAanpassing>());
    }

    function groepIndexNaarZIndex(index: number, groep: Laaggroep): number {
      switch (groep) {
        case "Achtergrond":
          return AchtergrondIndex;
        case "Tools":
          return ToolIndex;
        case "Voorgrond":
          return VoorgrondIndexStart + index;
      }
    }

    function layerIndexNaarGroepIndex(layer: ol.layer.Base, groep: Laaggroep): number {
      switch (groep) {
        case "Achtergrond":
          return 0;
        case "Tools":
          return 0;
        case "Voorgrond":
          return layer.getZIndex() - VoorgrondIndexStart;
      }
    }

    function layerNaarLaaggroep(layer: ol.layer.Base): Laaggroep {
      switch (layer.getZIndex()) {
        case AchtergrondIndex:
          return "Achtergrond";
        case ToolIndex:
          return "Tools";
        default:
          return "Voorgrond"; // We zouden range check kunnen doen, maar dan moeten we exceptie smijten of validation gebruiken
      }
    }

    function maxIndexInGroep(groep: Laaggroep) {
      switch (groep) {
        case "Achtergrond":
          return AchtergrondIndex;
        case "Voorgrond":
          return ToolIndex - 1;
        case "Tools":
          return ToolIndex;
      }
    }

    function zendLagenInGroep(mdl: Model, groep: Laaggroep): void {
      mdl.groeplagenSubj.next({
        laaggroep: groep,
        lagen: mdl.titelsOpGroep
          .get(groep)
          .map(
            titel => mdl.lagen.find(l => l!.titel === titel) //
          )
          .toList()
      });
    }

    function zetLayerIndex(layer: ol.layer.Base, groepIndex: number, groep: Laaggroep): void {
      layer.setZIndex(groepIndexNaarZIndex(groepIndex, groep));
    }

    function limitPosition(position: number, groep: Laaggroep) {
      // laat 1 positie voorbij het einde toe om laag kunnen toe te voegen
      return Math.max(0, Math.min(position, model.titelsOpGroep.get(groep).size));
    }

    /**
     * Een laag toevoegen. Faalt als er al een laag met die titel bestaat.
     */
    function voegLaagToeCmd(cmnd: prt.VoegLaagToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLaagTitelBestaatNiet(cmnd.laag.titel)
          .chain(() => valideerAlsLayer(cmnd.laag))
          .map(layer => {
            const titel = cmnd.laag.titel;
            const groep = cmnd.laaggroep;
            const groepPositie = limitPosition(cmnd.positie, groep);
            const movedLayers = pasZIndicesAan(1, groepPositie, maxIndexInGroep(groep), groep);
            layer.setVisible(cmnd.magGetoondWorden); // achtergrondlagen expliciet zichtbaar maken!
            zetLayerIndex(layer, groepPositie, groep);
            model.map.addLayer(layer);
            const updatedModel = {
              ...model,
              olLayersOpTitel: model.olLayersOpTitel.set(titel, layer),
              titelsOpGroep: model.titelsOpGroep.set(groep, model.titelsOpGroep.get(groep).push(titel)),
              groepOpTitel: model.groepOpTitel.set(titel, groep),
              lagen: model.lagen.push(cmnd.laag)
            };
            zendLagenInGroep(updatedModel, cmnd.laaggroep);
            return ModelAndValue(updatedModel, movedLayers.push({ titel: titel, positie: groepPositie }));
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
          const titel = cmnd.titel;
          const groep = model.groepOpTitel.get(titel);
          const movedLayers = pasZIndicesAan(-1, layerIndexNaarGroepIndex(layer, groep) + 1, maxIndexInGroep(groep), groep);
          const updatedModel = {
            ...model,
            olLayersOpTitel: model.olLayersOpTitel.delete(titel),
            titelsOpGroep: model.titelsOpGroep.set(
              groep,
              model.titelsOpGroep
                .get(groep)
                .filter(t => t !== titel)
                .toList()
            ),
            groepOpTitel: model.groepOpTitel.delete(titel),
            lagen: model.lagen.filterNot(l => l!.titel === titel).toList()
          };
          zendLagenInGroep(updatedModel, groep);
          return ModelAndValue(updatedModel, movedLayers); // De verwijderde laag zelf wordt niet teruggegeven
        })
      );
    }

    function verplaatsLaagCmd(cmnd: prt.VerplaatsLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel)
          .chain(valideerIsVoorgrondlaag) // enkel zinvol om voorgrondlagen te verplaatsen
          .map(layer => {
            const titel = cmnd.titel;
            const groep = model.groepOpTitel.get(titel);
            const vanPositie = layerIndexNaarGroepIndex(layer, groep);
            const naarPositie = limitPosition(cmnd.naarPositie, groep); // uitgedrukt in z-index waarden
            // Afhankelijk of we van onder naar boven of van boven naar onder verschuiven, moeten de tussenliggende lagen
            // naar onder, resp. naar boven verschoven worden.
            const movedLayers =
              vanPositie < naarPositie
                ? pasZIndicesAan(-1, vanPositie + 1, naarPositie, groep)
                : pasZIndicesAan(1, naarPositie, vanPositie - 1, groep);
            zetLayerIndex(layer, naarPositie, groep);
            return ModelAndValue(model, movedLayers.push({ titel: cmnd.titel, positie: naarPositie }));
          })
      );
    }

    function voegSchaalToeCmd(cmnd: prt.VoegSchaalToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.schaal, isNone, "De schaal is al toegevoegd").map(() => {
          const schaal = new ol.control.ScaleLine();
          model.map.addControl(schaal);
          return ModelAndEmptyResult({ ...model, schaal: some(schaal) });
        })
      );
    }

    function verwijderSchaalCmd(cmnd: prt.VerwijderSchaalCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromOption(model.schaal, "De schaal is nog niet toegevoegd").map((schaal: ol.control.Control) => {
          model.map.removeControl(schaal);
          return ModelAndEmptyResult({ ...model, schaal: none });
        })
      );
    }

    function voegVolledigSchermToeCmd(cmnd: prt.VoegVolledigSchermToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.fullScreen, isNone, "De volledig scherm knop is al toegevoegd").map(() => {
          const fullScreen = new ol.control.FullScreen();
          model.map.addControl(fullScreen);
          return ModelAndEmptyResult({ ...model, fullScreen: some(fullScreen) });
        })
      );
    }

    function verwijderVolledigSchermCmd(cmnd: prt.VerwijderVolledigSchermCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromOption(model.fullScreen, "De volledig scherm knop is nog niet toegevoegd").map((fullScreen: ol.control.Control) => {
          model.map.removeControl(fullScreen);
          return ModelAndEmptyResult({ ...model, fullScreen: none });
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
          const interacties: List<ol.interaction.Interaction> = List<ol.interaction.Interaction>(stdInteracties).push(
            new ol.interaction.MouseWheelZoom({ constrainResolution: true }) // Geen fractionele resoluties!
          );
          interacties.forEach(i => model.map.addInteraction(i!)); // side effects :-(
          const newModel: Model = { ...model, stdInteracties: interacties, scrollZoomOnFocus: cmnd.scrollZoomOnFocus };
          activateMouseWheelZoomIfAllowed(!cmnd.scrollZoomOnFocus, newModel);
          return ModelAndEmptyResult(newModel);
        })
      );
    }

    function verwijderStandaardInteractiesCmd(cmnd: prt.VerwijderStandaardInteractiesCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.stdInteracties, l => !l.isEmpty(), "De standaard interacties zijn niet aanwezig").map(
          (stdInteracties: List<ol.interaction.Interaction>) => {
            stdInteracties.forEach(i => model.map.removeInteraction(i!));
            return ModelAndEmptyResult({ ...model, fullScreen: none });
          }
        )
      );
    }

    function veranderMiddelpuntCmd(cmnd: prt.VeranderMiddelpuntCmd<Msg>): ModelWithResult<Msg> {
      model.map.getView().setCenter(cmnd.coordinate);
      return ModelWithResult(model);
    }

    function veranderZoomniveauCmd(cmnd: prt.VeranderZoomCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerAlsGeheel(cmnd.zoom).map(zoom => {
          model.map.getView().setZoom(cmnd.zoom);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function veranderExtentCmd(cmnd: prt.VeranderExtentCmd<Msg>): ModelWithResult<Msg> {
      model.map.getView().fit(cmnd.extent);
      return ModelWithResult(model);
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
      return ModelWithResult(model);
    }

    function focusOpKaartCmd(cmnd: prt.ZetFocusOpKaartCmd<Msg>): ModelWithResult<Msg> {
      activateMouseWheelZoomIfAllowed(true);
      return ModelWithResult(model);
    }

    function verliesFocusOpKaartCmd(cmnd: prt.VerliesFocusOpKaartCmd<Msg>): ModelWithResult<Msg> {
      activateMouseWheelZoomIfAllowed(false);
      return ModelWithResult(model);
    }

    function activateMouseWheelZoomIfAllowed(active: boolean, mdl: Model = model): void {
      if (mdl.scrollZoomOnFocus) {
        mdl.stdInteracties
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
          return ModelAndEmptyResult(model);
        })
      );
    }

    function toonAchtergrondKeuzeCmd(cmnd: prt.ToonAchtergrondKeuzeCmd<Msg>): ModelWithResult<Msg> {
      const achtergrondTitels = model.titelsOpGroep.get("Achtergrond");
      return toModelWithValueResult(
        cmnd.wrapper,
        allOf([
          fromBoolean(!model.showBackgroundSelector, "De achtergrondkeuze is al actief"),
          fromBoolean(!achtergrondTitels.isEmpty(), "Er moet minstens 1 achtergrondlaag zijn")
        ]).map(() => {
          achtergrondTitels.forEach(titel => model.olLayersOpTitel.get(titel!).setVisible(false));
          const geselecteerdeTitel = fromNullable(achtergrondTitels.find(titel => model.olLayersOpTitel.get(titel!).getVisible()));
          const teSelecterenTitel = geselecteerdeTitel.getOrElse(() => achtergrondTitels.first()); // er is er minstens 1 wegens validatie
          const achtergrondLayer = model.olLayersOpTitel.get(teSelecterenTitel);
          achtergrondLayer.setVisible(true);
          model.achtergrondlaagtitelSubj.next(teSelecterenTitel);
          return ModelAndEmptyResult({ ...model, showBackgroundSelector: true });
        })
      );
    }

    function verbergAchtergrondKeuzeCmd(cmnd: prt.VerbergAchtergrondKeuzeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromBoolean(model.showBackgroundSelector, "De achtergrondkeuze is niet actief") //
          .map(() => ModelAndEmptyResult({ ...model, showBackgroundSelector: false }))
      );
    }

    function kiesAchtergrondCmd(cmnd: prt.KiesAchtergrondCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerIsAchtergrondLaag(cmnd.titel)
          .chain(() => valideerLayerBestaat(cmnd.titel))
          .map(nieuweAchtergrond => {
            const achtergrondTitels = model.titelsOpGroep.get("Achtergrond");
            const vorigeTitel = fromNullable(achtergrondTitels.find(titel => model.olLayersOpTitel.get(titel!).getVisible()));
            const vorigeAchtergrond = vorigeTitel.map(titel => model.olLayersOpTitel.get(titel));
            forEach(vorigeAchtergrond, l => l.setVisible(false));
            nieuweAchtergrond.setVisible(true);
            model.achtergrondlaagtitelSubj.next(cmnd.titel);
            return ModelAndEmptyResult(model);
          })
      );
    }

    function maakLaagZichtbaarCmd(cmnd: prt.MaakLaagZichtbaarCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel).map(layer => {
          layer.setVisible(true);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function maakLaagOnzichtbaarCmd(cmnd: prt.MaakLaagOnzichtbaarCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerLayerBestaat(cmnd.titel).map(layer => {
          layer.setVisible(false);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function zetStijlVoorLaagCmd(cmnd: prt.ZetStijlVoorLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerVectorLayerBestaat(cmnd.titel).map(vectorlayer => {
          const sf = (feature: ol.Feature, resolution: number) => {
            return (cmnd.stijl as ke.DynamicStyle).styleFunction(feature, resolution);
          };
          vectorlayer.setStyle(cmnd.stijl.type === "StaticStyle" ? cmnd.stijl.style : sf);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function meldComponentFout(cmnd: prt.MeldComponentFoutCmd<Msg>): ModelWithResult<Msg> {
      model.componentFoutSubj.next(cmnd.fouten);
      return ModelWithResult(model);
    }

    function handleSubscriptions(cmnd: prt.SubscriptionCmd<Msg>): ModelWithResult<Msg> {
      function subscribe(subscription: Subscription): ModelWithResult<Msg> {
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      function subscribeToZoominstellingen(sub: prt.ZoominstellingenSubscription<Msg>): ModelWithResult<Msg> {
        const subscription = model.zoominstellingenSubj.pipe(debounceTime(100)).subscribe(z => msgConsumer(sub.wrapper(z)));
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      function subscribeToMiddelpunt(sub: prt.MiddelpuntSubscription<Msg>): ModelWithResult<Msg> {
        const subscription = model.middelpuntSubj.pipe(debounceTime(100)).subscribe(m => msgConsumer(sub.wrapper(m[0], m[1])));
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      function subscribeToAchtergrondTitel(sub: prt.AchtergrondTitelSubscription<Msg>): ModelWithResult<Msg> {
        const subscription = model.achtergrondlaagtitelSubj.subscribe(t => msgConsumer(sub.wrapper(t)));
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, subscription)));
      }

      const subscribeToAchtergrondlagen = (wrapper: (achtergrondlagen: List<ke.AchtergrondLaag>) => Msg) =>
        subscribe(
          model.groeplagenSubj
            .pipe(
              filter(groeplagen => groeplagen.laaggroep === "Achtergrond") //
            )
            .subscribe(groeplagen => msgConsumer(wrapper(groeplagen.lagen as List<ke.AchtergrondLaag>)))
        );

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
