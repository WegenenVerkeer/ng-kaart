import * as array from "fp-ts/lib/Array";
import { getArrayMonoid } from "fp-ts/lib/Monoid";
import { fromNullable, isNone, none, Option, some } from "fp-ts/lib/Option";
import { sequence } from "fp-ts/lib/Traversable";
import * as validation from "fp-ts/lib/Validation";
import { pipe } from "fp-ts/lib/function";
import { List } from "immutable";
import * as ol from "openlayers";
import { olx } from "openlayers";
import { Subscription } from "rxjs";
import { debounceTime, filter, distinctUntilChanged } from "rxjs/operators";
import * as rx from "rxjs";

import { forEach } from "../util/option";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { ModelChanger } from "./model-changes";
import { PositieAanpassing, ZetMijnLocatieZoomCmd, VoegUiElementToe, ZetUiElementOpties } from "./kaart-protocol-commands";
import { KaartWithInfo, setStyleSelector, setSelectionStyleSelector, getSelectionStyleSelector } from "./kaart-with-info";
import { toOlLayer } from "./laag-converter";
import { kaartLogger } from "./log";
import { DynamicStyle, StaticStyle, Styles, determineStyle, VectorLaag } from "./kaart-elementen";
import { getDefaultStyle } from "./styles";
import { VectorType } from "./kaart-elementen";

///////////////////////////////////
// Hulpfuncties
//

export type Model = KaartWithInfo;

export interface ModelWithResult<Msg> {
  model: KaartWithInfo;
  message: Option<Msg>;
}

const AchtergrondIndex = 0;
const VoorgrondLaagIndexStart = 1;
const VoorgrondHoogIndexStart = 100001;
const ToolIndex = 1000000;

function ModelWithResult<Msg>(model: Model, message: Option<Msg> = none): ModelWithResult<Msg> {
  return {
    model: model,
    message: message
  };
}

export function kaartCmdReducer<Msg extends prt.KaartMsg>(
  cmd: prt.Command<Msg>
): (model: Model, modelChanger: ModelChanger, msgConsumer: prt.MessageConsumer<Msg>) => ModelWithResult<Msg> {
  return (model: Model, modelChanger: ModelChanger, msgConsumer: prt.MessageConsumer<Msg>) => {
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

    function valideerToegevoegdLaagBestaat(titel: string): prt.KaartCmdValidation<ke.ToegevoegdeLaag> {
      return validation.fromPredicate(getArrayMonoid<string>())(
        (l: ke.ToegevoegdeLaag) => l !== undefined,
        () => [`Een laag met titel ${titel} bestaat niet`]
      )(model.toegevoegdeLagenOpTitel.get(titel));
    }

    function valideerVectorLayerBestaat(titel: string): prt.KaartCmdValidation<ol.layer.Vector> {
      return valideerToegevoegdLaagBestaat(titel).chain(
        laag =>
          laag.layer["setStyle"]
            ? validation.success(laag.layer as ol.layer.Vector)
            : validation.failure(getArrayMonoid<string>())([`De laag met titel ${titel} is geen vectorlaag`])
      );
    }

    function valideerLaagTitelBestaatNiet(titel: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(model, (mdl: Model) => !mdl.toegevoegdeLagenOpTitel.has(titel), `Een laag met titel ${titel} bestaat al`);
    }

    function valideerZoekerIsNietGeregistreerd(naam: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(
        model,
        (mdl: Model) => !mdl.zoekerCoordinator.isZoekerGeregistreerd(naam),
        `Een zoeker met naam ${naam} bestaat al`
      );
    }

    function valideerZoekerIsGeregistreerd(naam: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(
        model,
        (mdl: Model) => mdl.zoekerCoordinator.isZoekerGeregistreerd(naam),
        `Een zoeker met naam ${naam} bestaat niet`
      );
    }

    function valideerMinstens1ZoekerGeregistreerd(): prt.KaartCmdValidation<{}> {
      return fromPredicate(
        model,
        (mdl: Model) => mdl.zoekerCoordinator.isMinstens1ZoekerGeregistreerd(),
        `Er moet minstens 1 zoeker geregistreerd zijn`
      );
    }

    const valideerIsAchtergrondLaag: (titel: string) => prt.KaartCmdValidation<{}> = (titel: string) =>
      fromBoolean(model.groepOpTitel.get(titel) === "Achtergrond", "De laag is geen achtergrondlaag");

    const valideerIsVoorgrondlaag: (laag: ke.ToegevoegdeLaag) => prt.KaartCmdValidation<ke.ToegevoegdeLaag> = (laag: ke.ToegevoegdeLaag) =>
      fromPredicate(
        laag,
        (lg: ke.ToegevoegdeLaag) => lg.laaggroep === "Voorgrond.Hoog" || lg.laaggroep === "Voorgrond.Laag",
        "De laag is geen voorgrondlaag"
      );

    const valideerAlsLayer: (laag: ke.Laag) => prt.KaartCmdValidation<ol.layer.Base> = (laag: ke.Laag) =>
      fromOption(toOlLayer(model, laag), "De laagbeschrijving kon niet naar een openlayers laag omgezet");

    const valideerAlsGeheel = (num: number) => fromPredicate(num, Number.isInteger, `'${num}' is geen geheel getal`);

    /**
     * Alle lagen in een gegeven bereik van z-indices aanpassen. Belangrijk om bij toevoegen, verwijderen en verplaatsen,
     * alle z-indices in een aangesloten interval te behouden.
     */
    function pasZIndicesAan(aanpassing: number, vanaf: number, tot: number, groep: ke.Laaggroep): List<PositieAanpassing> {
      return model.toegevoegdeLagenOpTitel.reduce((updates, laag, titel) => {
        if (layerNaarLaaggroep(<ol.layer.Base>laag!.layer) === groep) {
          const groepPositie = layerIndexNaarGroepIndex(laag!.layer, groep);
          if (groepPositie >= vanaf && groepPositie <= tot) {
            const positie = groepPositie + aanpassing;
            zetLayerIndex(laag!.layer, positie, groep);
            return updates!.push({ titel: titel!, positie: positie });
          } else {
            return updates!;
          }
        } else {
          return updates!;
        }
      }, List<prt.PositieAanpassing>());
    }

    function groepIndexNaarZIndex(index: number, groep: ke.Laaggroep): number {
      switch (groep) {
        case "Achtergrond":
          return AchtergrondIndex;
        case "Tools":
          return ToolIndex;
        case "Voorgrond.Hoog":
          return VoorgrondHoogIndexStart + index;
        case "Voorgrond.Laag":
          return VoorgrondLaagIndexStart + index;
      }
    }

    function layerIndexNaarGroepIndex(layer: ol.layer.Base, groep: ke.Laaggroep): number {
      switch (groep) {
        case "Achtergrond":
          return 0;
        case "Tools":
          return 0;
        case "Voorgrond.Hoog":
          return layer.getZIndex() - VoorgrondHoogIndexStart;
        case "Voorgrond.Laag":
          return layer.getZIndex() - VoorgrondLaagIndexStart;
      }
    }

    function layerNaarLaaggroep(layer: ol.layer.Base): ke.Laaggroep {
      switch (layer.getZIndex()) {
        case AchtergrondIndex:
          return "Achtergrond";
        case ToolIndex:
          return "Tools";
        default:
          // We zouden range check kunnen doen, maar dan moeten we exceptie smijten of validation gebruiken
          return layer.getZIndex() < VoorgrondHoogIndexStart ? "Voorgrond.Laag" : "Voorgrond.Hoog";
      }
    }

    function maxIndexInGroep(groep: ke.Laaggroep) {
      switch (groep) {
        case "Achtergrond":
          return AchtergrondIndex;
        case "Voorgrond.Laag":
          return VoorgrondHoogIndexStart - 1;
        case "Voorgrond.Hoog":
          return ToolIndex - 1;
        case "Tools":
          return ToolIndex;
      }
    }

    function zendLagenInGroep(mdl: Model, groep: ke.Laaggroep): void {
      mdl.groeplagenSubj.next({
        laaggroep: groep,
        lagen: mdl.titelsOpGroep
          .get(groep)
          .map(titel => mdl.toegevoegdeLagenOpTitel.get(titel!)) // we vertrekken van geldige groepen
          .sortBy(laag => -laag!.layer.getZIndex()) // en dus ook geldige titels
          .toList()
      });
    }

    function zetLayerIndex(layer: ol.layer.Base, groepIndex: number, groep: ke.Laaggroep): void {
      layer.setZIndex(groepIndexNaarZIndex(groepIndex, groep));
    }

    function limitPosition(position: number, groep: ke.Laaggroep) {
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
            const toegevoegdeLaag: ke.ToegevoegdeLaag = {
              bron: cmnd.laag,
              layer: layer,
              titel: cmnd.laag.titel,
              laaggroep: groep,
              positieInGroep: groepPositie,
              magGetoondWorden: cmnd.magGetoondWorden
            };
            layer.set("titel", titel);
            layer.setVisible(cmnd.magGetoondWorden); // achtergrondlagen expliciet zichtbaar maken!
            zetLayerIndex(layer, groepPositie, groep);
            model.map.addLayer(layer);
            const updatedModel = {
              ...model,
              toegevoegdeLagenOpTitel: model.toegevoegdeLagenOpTitel.set(titel, toegevoegdeLaag),
              titelsOpGroep: model.titelsOpGroep.set(groep, model.titelsOpGroep.get(groep).push(titel)),
              groepOpTitel: model.groepOpTitel.set(titel, groep)
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
        valideerToegevoegdLaagBestaat(cmnd.titel).map(laag => {
          const layer = laag.layer;
          model.map.removeLayer(layer); // Oesje. Side-effect. Gelukkig idempotent.
          const titel = cmnd.titel;
          const groep = model.groepOpTitel.get(titel);
          const movedLayers = pasZIndicesAan(-1, layerIndexNaarGroepIndex(layer, groep) + 1, maxIndexInGroep(groep), groep);
          const updatedModel = {
            ...model,
            toegevoegdeLagenOpTitel: model.toegevoegdeLagenOpTitel.delete(titel),
            titelsOpGroep: model.titelsOpGroep.set(
              groep,
              model.titelsOpGroep
                .get(groep)
                .filter(t => t !== titel)
                .toList()
            ),
            groepOpTitel: model.groepOpTitel.delete(titel)
          };
          zendLagenInGroep(updatedModel, groep);
          return ModelAndValue(updatedModel, movedLayers); // De verwijderde laag zelf wordt niet teruggegeven
        })
      );
    }

    function verplaatsLaagCmd(cmnd: prt.VerplaatsLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerToegevoegdLaagBestaat(cmnd.titel)
          .chain(valideerIsVoorgrondlaag) // enkel zinvol om voorgrondlagen te verplaatsen
          .map(laag => {
            const titel = cmnd.titel;
            const groep = model.groepOpTitel.get(titel);
            const vanPositie = layerIndexNaarGroepIndex(laag.layer, groep);
            const naarPositie = limitPosition(cmnd.naarPositie, groep); // uitgedrukt in z-index waarden
            // Afhankelijk of we van onder naar boven of van boven naar onder verschuiven, moeten de tussenliggende lagen
            // naar onder, resp. naar boven verschoven worden.
            const verplaatsteTitels = (vanPositie < naarPositie
              ? pasZIndicesAan(-1, vanPositie + 1, naarPositie, groep)
              : pasZIndicesAan(1, naarPositie, vanPositie - 1, groep)
            ).push({ titel: cmnd.titel, positie: naarPositie }); // De geïmpacteerde lagen + de verplaatste laag
            zetLayerIndex(laag.layer, naarPositie, groep);
            const updatedToegevoegdeLagenOpTitel = verplaatsteTitels.reduce(
              (lagen, laagPos) =>
                lagen!.set(laagPos!.titel, {
                  // We veranderen niks aan de keys, dus kunnen we vertrouwen op get
                  ...lagen!.get(laagPos!.titel),
                  positieInGroep: laagPos!.positie
                }),
              model.toegevoegdeLagenOpTitel
            );
            const updatedModel = { ...model, toegevoegdeLagenOpTitel: updatedToegevoegdeLagenOpTitel };
            zendLagenInGroep(updatedModel, groep);
            return ModelAndValue(updatedModel, verplaatsteTitels);
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

    function veranderExtentCmd(cmnd: prt.VeranderExtentCmd): ModelWithResult<Msg> {
      model.map.getView().fit(cmnd.extent);
      return ModelWithResult(model);
    }

    function veranderViewportCmd(cmnd: prt.VeranderViewportCmd): ModelWithResult<Msg> {
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

    function focusOpKaartCmd(cmnd: prt.ZetFocusOpKaartCmd): ModelWithResult<Msg> {
      activateMouseWheelZoomIfAllowed(true);
      return ModelWithResult(model);
    }

    function verliesFocusOpKaartCmd(cmnd: prt.VerliesFocusOpKaartCmd): ModelWithResult<Msg> {
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
          layer.getSource().clear(false);
          layer.getSource().addFeatures(cmnd.features.toArray());
          return ModelAndEmptyResult(model);
        })
      );
    }

    // Lensaardig met side-effect
    const pasLaagZichtbaarheidAan: (toon: boolean) => (laag: ke.ToegevoegdeLaag) => ke.ToegevoegdeLaag = magGetoondWorden => laag => {
      laag.layer.setVisible(magGetoondWorden);
      return laag.magGetoondWorden === magGetoondWorden ? laag : { ...laag, magGetoondWorden: magGetoondWorden };
    };

    // Uiteraard is het *nooit* de bedoeling om de titel van een laag aan te passen.
    const pasLaagInModelAan: (mdl: Model) => (laag: ke.ToegevoegdeLaag) => Model = mdl => laag => ({
      ...mdl,
      toegevoegdeLagenOpTitel: mdl.toegevoegdeLagenOpTitel.set(laag.titel, laag)
    });

    function toonAchtergrondkeuzeCmd(cmnd: prt.ToonAchtergrondKeuzeCmd<Msg>): ModelWithResult<Msg> {
      const achtergrondTitels = model.titelsOpGroep.get("Achtergrond");
      return toModelWithValueResult(
        cmnd.wrapper,
        allOf([
          fromBoolean(!model.showBackgroundSelector, "De achtergrondkeuze is al actief"),
          fromBoolean(!achtergrondTitels.isEmpty(), "Er moet minstens 1 achtergrondlaag zijn")
        ]).map(() => {
          const achtergrondLagen: List<ke.ToegevoegdeLaag> = model.titelsOpGroep
            .get("Achtergrond")
            .map(titel => model.toegevoegdeLagenOpTitel.get(titel!)) // de titels bestaan bij constructie
            .toList();
          const geselecteerdeLaag = fromNullable(achtergrondLagen.find(laag => laag!.magGetoondWorden));
          const teSelecterenLaag = geselecteerdeLaag.getOrElse(() => achtergrondLagen.first()); // er is er minstens 1 wegens validatie

          // Zorg ervoor dat er juist 1 achtergrondlaag zichtbaar is
          const modelMetAangepasteLagen = achtergrondLagen.reduce(
            (mdl, laag) => pipe(pasLaagZichtbaarheidAan(laag!.titel === teSelecterenLaag.titel), pasLaagInModelAan(mdl!))(laag!),
            model
          );

          model.achtergrondlaagtitelSubj.next(teSelecterenLaag.titel);
          modelChanger.uiElementSelectieSubj.next({ naam: "Achtergrondkeuze", aan: true });
          return ModelAndEmptyResult({
            ...modelMetAangepasteLagen,
            showBackgroundSelector: true
          });
        })
      );
    }

    function verbergAchtergrondkeuzeCmd(cmnd: prt.VerbergAchtergrondKeuzeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromBoolean(model.showBackgroundSelector, "De achtergrondkeuze is niet actief") //
          .map(() => {
            modelChanger.uiElementSelectieSubj.next({ naam: "Achtergrondkeuze", aan: false });
            return ModelAndEmptyResult({ ...model, showBackgroundSelector: false });
          })
      );
    }

    function kiesAchtergrondCmd(cmnd: prt.KiesAchtergrondCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerIsAchtergrondLaag(cmnd.titel)
          .chain(() => valideerToegevoegdLaagBestaat(cmnd.titel))
          .map((nieuweAchtergrond: ke.ToegevoegdeLaag) => {
            model.achtergrondlaagtitelSubj.next(cmnd.titel);
            const maybeVorigeAchtergrond = fromNullable(
              model.toegevoegdeLagenOpTitel.find(laag => laag!.laaggroep === "Achtergrond" && laag!.magGetoondWorden)
            );
            const modelMetNieuweZichtbaarheid = pipe(pasLaagZichtbaarheidAan(true), pasLaagInModelAan(model))(nieuweAchtergrond);
            return maybeVorigeAchtergrond.fold(
              () => ModelAndEmptyResult(modelMetNieuweZichtbaarheid), //
              vorigeAchtergrond =>
                ModelAndEmptyResult(pipe(pasLaagZichtbaarheidAan(false), pasLaagInModelAan(modelMetNieuweZichtbaarheid))(vorigeAchtergrond))
            );
          })
      );
    }

    function maakLaagZichtbaarCmd(cmnd: prt.MaakLaagZichtbaarCmd<Msg>): ModelWithResult<Msg> {
      return zetLaagZichtbaarheid(cmnd.titel, true, cmnd.wrapper);
    }

    function maakLaagOnzichtbaarCmd(cmnd: prt.MaakLaagOnzichtbaarCmd<Msg>): ModelWithResult<Msg> {
      return zetLaagZichtbaarheid(cmnd.titel, false, cmnd.wrapper);
    }

    function zetLaagZichtbaarheid(titel: string, magGetoondWorden: boolean, wrapper: prt.BareValidationWrapper<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        wrapper,
        valideerToegevoegdLaagBestaat(titel).map(laag => {
          const aangepastModel = pipe(pasLaagZichtbaarheidAan(magGetoondWorden), pasLaagInModelAan(model))(laag);
          zendLagenInGroep(aangepastModel, laag.laaggroep);
          return ModelAndEmptyResult(aangepastModel);
        })
      );
    }

    function activeerSelectieModus(cmnd: prt.ActiveerSelectieModusCmd<Msg>): ModelWithResult<Msg> {
      model.map.getInteractions().forEach(interaction => {
        if (interaction instanceof ol.interaction.Select) {
          model.map.removeInteraction(interaction);
        }
      });

      const applySelectFunction = function(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
        const applySelectionColor = function(style: ol.style.Style): ol.style.Style {
          const selectionStyle = style.clone();
          selectionStyle.getStroke().setColor([0, 153, 255, 1]);
          return selectionStyle;
        };

        const styleSelector = getSelectionStyleSelector(model, feature.get("laagnaam"));
        if (styleSelector) {
          switch (styleSelector.type) {
            case "StaticStyle":
              return styleSelector.style;
            case "Styles":
              return styleSelector.styles;
            case "DynamicStyle":
              const toegepasteStijl = styleSelector.styleFunction(feature, resolution);
              if (Array.isArray(toegepasteStijl)) {
                return toegepasteStijl.map(style => applySelectionColor(style));
              } else {
                return applySelectionColor(toegepasteStijl);
              }
            default:
              kaartLogger.error("Ongekend styleSelector type");
              kaartLogger.error(feature);
              return [];
          }
        } else {
          kaartLogger.warn("Geen stijl gevonden voor feature:");
          kaartLogger.warn(feature);
          return []; // geen stijl functie gevonden.. Is dit een nosql vector laag?
        }
      };

      function getSelectInteraction(modus: prt.SelectieModus): Option<olx.interaction.SelectOptions> {
        switch (modus) {
          case "single":
            return some({
              condition: ol.events.condition.click,
              features: model.geselecteerdeFeatures,
              multi: true,
              style: applySelectFunction
            });
          case "multiple":
            return some({
              condition: ol.events.condition.click,
              toggleCondition: ol.events.condition.click,
              features: model.geselecteerdeFeatures,
              multi: true,
              style: applySelectFunction
            });
          case "none":
            return none;
        }
      }

      getSelectInteraction(cmnd.selectieModus).map(selectInteraction => {
        model.map.addInteraction(new ol.interaction.Select(selectInteraction));
        model.map.addInteraction(
          new ol.interaction.DragBox({
            condition: ol.events.condition.platformModifierKeyOnly
          })
        );
      });

      return ModelWithResult(model);
    }

    function zetStijlVoorLaagCmd(cmnd: prt.ZetStijlVoorLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerVectorLayerBestaat(cmnd.titel).map(vectorlayer => {
          vectorlayer.setStyle(determineStyle(some(cmnd.stijl), getDefaultStyle()));
          setStyleSelector(model, cmnd.titel, cmnd.stijl);
          cmnd.selectieStijl.map(selectieStijl => setSelectionStyleSelector(model, cmnd.titel, selectieStijl));
          return ModelAndEmptyResult(model);
        })
      );
    }

    function toonInfoBoodschap(cmnd: prt.ToonInfoBoodschapCmd): ModelWithResult<Msg> {
      const boodschap = {
        ...cmnd.boodschap,
        laag: fromNullable(model.toegevoegdeLagenOpTitel.get(cmnd.boodschap.titel))
          .filter(laag => laag.bron.type === VectorType)
          .map(laag => laag.bron as VectorLaag)
      };
      model.infoBoodschappenSubj.next(model.infoBoodschappenSubj.getValue().set(boodschap.id, boodschap));
      return ModelWithResult(model);
    }

    function deleteInfoBoodschap(cmnd: prt.VerbergInfoBoodschapCmd): ModelWithResult<Msg> {
      model.infoBoodschappenSubj.next(model.infoBoodschappenSubj.getValue().delete(cmnd.id));
      return ModelWithResult(model);
    }

    function deselecteerFeature(cmnd: prt.DeselecteerFeatureCmd): ModelWithResult<Msg> {
      const maybeSelectedFeature = fromNullable(model.geselecteerdeFeatures.getArray().find(f => f.get("id") === cmnd.id));
      forEach(maybeSelectedFeature, selected => model.geselecteerdeFeatures.remove(selected));
      return ModelWithResult(model);
    }

    function sluitInfoBoodschap(cmnd: prt.SluitInfoBoodschapCmd<Msg>): ModelWithResult<Msg> {
      const maybeMsg = cmnd.msgGen() as Option<Msg>;
      return maybeMsg.fold(
        () => {
          // geen message uit functie, sluit de info boodschap zelf
          model.infoBoodschappenSubj.next(model.infoBoodschappenSubj.getValue().delete(cmnd.id));
          return ModelWithResult(model);
        },
        msg => {
          // stuur sluit message door
          return ModelWithResult(model, some(msg));
        }
      );
    }

    function meldComponentFout(cmnd: prt.MeldComponentFoutCmd): ModelWithResult<Msg> {
      model.componentFoutSubj.next(cmnd.fouten);
      return ModelWithResult(model);
    }

    function voegZoekerToe(cmnd: prt.VoegZoekerToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerZoekerIsNietGeregistreerd(cmnd.zoeker.naam()).map(() => {
          model.zoekerCoordinator.voegZoekerToe(cmnd.zoeker);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function verwijderZoeker(cmnd: prt.VerwijderZoekerCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerZoekerIsGeregistreerd(cmnd.zoeker).map(() => {
          model.zoekerCoordinator.verwijderZoeker(cmnd.zoeker);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function zoek(cmnd: prt.ZoekCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerMinstens1ZoekerGeregistreerd().map(() => {
          model.zoekerCoordinator.zoek(cmnd.input);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function zetMijnLocatieZoom(cmnd: prt.ZetMijnLocatieZoomCmd): ModelWithResult<Msg> {
      model.mijnLocatieZoomDoelSubj.next(cmnd.doelniveau);
      return ModelWithResult(model);
    }

    function voegInteractieToe(cmnd: prt.VoegInteractieToeCmd): ModelWithResult<Msg> {
      model.map.addInteraction(cmnd.interactie);
      return ModelWithResult(model);
    }

    function verwijderInteractie(cmnd: prt.VerwijderInteractieCmd): ModelWithResult<Msg> {
      model.map.removeInteraction(cmnd.interactie);
      return ModelWithResult(model);
    }

    function voegOverlayToe(cmnd: prt.VoegOverlayToeCmd): ModelWithResult<Msg> {
      model.map.addOverlay(cmnd.overlay);
      return ModelWithResult(model);
    }

    function verwijderOverlays(cmnd: prt.VerwijderOverlaysCmd): ModelWithResult<Msg> {
      cmnd.overlays.forEach(overlay => model.map.removeOverlay(overlay));
      return ModelWithResult(model);
    }

    function voegUiElementToe(cmnd: prt.VoegUiElementToe): ModelWithResult<Msg> {
      modelChanger.uiElementSelectieSubj.next({ naam: cmnd.naam, aan: true });
      return ModelWithResult(model);
    }

    function verwijderUiElement(cmnd: prt.VerwijderUiElement): ModelWithResult<Msg> {
      modelChanger.uiElementSelectieSubj.next({ naam: cmnd.naam, aan: false });
      return ModelWithResult(model);
    }

    function zetUiElementOpties(cmdn: prt.ZetUiElementOpties): ModelWithResult<Msg> {
      modelChanger.uiElementOptiesSubj.next({ naam: cmdn.naam, opties: cmdn.opties });
      return ModelWithResult(model);
    }

    function handleSubscriptions(cmnd: prt.SubscribeCmd<Msg>): ModelWithResult<Msg> {
      function modelWithSubscriptionResult(name: string, subscription: Subscription): ModelWithResult<Msg> {
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, { subscription: subscription, subscriberName: name })));
      }

      function subscribeToZoominstellingen(sub: prt.ZoominstellingenSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "Zoominstellingen",
          model.zoominstellingenSubj.pipe(debounceTime(100)).subscribe(z => msgConsumer(sub.wrapper(z)))
        );
      }

      function subscribeToGeselecteerdeFeatures(sub: prt.GeselecteerdeFeaturesSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "GeselecteerdeFeatures",
          model.geselecteerdeFeaturesSubj.subscribe(pm => msgConsumer(sub.wrapper(pm)))
        );
      }

      function subscribeToMiddelpunt(sub: prt.MiddelpuntSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "Middelpunt",
          model.middelpuntSubj.pipe(debounceTime(100)).subscribe(m => msgConsumer(sub.wrapper(m[0], m[1])))
        );
      }

      function subscribeToAchtergrondTitel(sub: prt.AchtergrondTitelSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("AchtergrondTitel", model.achtergrondlaagtitelSubj.subscribe(t => msgConsumer(sub.wrapper(t))));
      }

      function subscribeToKaartClick(sub: prt.KaartClickSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("KaartClick", model.clickSubj.subscribe(t => msgConsumer(sub.wrapper(t))));
      }

      const subscribeToLagenInGroep = (sub: prt.LagenInGroepSubscription<Msg>) => {
        // Op het moment van de subscription is het heel goed mogelijk dat de lagen al toegevoegd zijn. Het is daarom dat de
        // groeplagenSubj een vrij grote replay waarde heeft.
        return modelWithSubscriptionResult(
          "LagenInGroep",
          model.groeplagenSubj
            .pipe(
              filter(groeplagen => groeplagen.laaggroep === sub.groep) //
            )
            .subscribe(groeplagen => msgConsumer(sub.wrapper(groeplagen.lagen)))
        );
      };

      function subscribeToZoeker(sub: prt.ZoekerSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("Zoeker", model.zoekerSubj.subscribe(m => msgConsumer(sub.wrapper(m))));
      }

      function subscribeToMijnLocatieZoomdoel(sub: prt.MijnLocatieZoomdoelSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "MijnLocatieZoomdoel",
          model.mijnLocatieZoomDoelSubj.subscribe(t => msgConsumer(sub.wrapper(t)))
        );
      }

      function subscribeToGeometryChanged(sub: prt.GeometryChangedSubscription<Msg>): ModelWithResult<Msg> {
        // Deze is een klein beetje speciaal omdat we de unsubcribe willen opvangen om evt. het tekenen te stoppen
        return modelWithSubscriptionResult(
          "TekenGeometryChanged",
          rx.Observable.create((observer: rx.Observer<ol.geom.Geometry>) => {
            model.tekenSettingsSubj.next(some(sub.tekenSettings));
            const innerSub = model.geometryChangedSubj.pipe(debounceTime(100)).subscribe(observer);
            return () => {
              innerSub.unsubscribe();
              if (model.geometryChangedSubj.observers.length === 0) {
                model.tekenSettingsSubj.next(none);
              }
            };
          }).subscribe(pm => msgConsumer(sub.wrapper(pm)))
        );
      }

      function subscribeToTekenen(sub: prt.TekenenSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "Tekenen",
          model.tekenSettingsSubj.pipe(distinctUntilChanged()).subscribe(pm => msgConsumer(sub.wrapper(pm)))
        );
      }

      function subscribeToInfoBoodschappen(sub: prt.InfoBoodschappenSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("InfoBoodschappen", model.infoBoodschappenSubj.subscribe(t => msgConsumer(sub.wrapper(t))));
      }

      switch (cmnd.subscription.type) {
        case "Zoominstellingen":
          return subscribeToZoominstellingen(cmnd.subscription);
        case "Middelpunt":
          return subscribeToMiddelpunt(cmnd.subscription);
        case "Achtergrond":
          return subscribeToAchtergrondTitel(cmnd.subscription);
        case "GeselecteerdeFeatures":
          return subscribeToGeselecteerdeFeatures(cmnd.subscription);
        case "LagenInGroep":
          return subscribeToLagenInGroep(cmnd.subscription);
        case "KaartClick":
          return subscribeToKaartClick(cmnd.subscription);
        case "MijnLocatieZoomdoel":
          return subscribeToMijnLocatieZoomdoel(cmnd.subscription);
        case "Zoeker":
          return subscribeToZoeker(cmnd.subscription);
        case "GeometryChanged":
          return subscribeToGeometryChanged(cmnd.subscription);
        case "Tekenen":
          return subscribeToTekenen(cmnd.subscription);
        case "InfoBoodschap":
          return subscribeToInfoBoodschappen(cmnd.subscription);
      }
    }

    function handleUnsubscriptions(cmnd: prt.UnsubscribeCmd): ModelWithResult<Msg> {
      cmnd.subscriptionResult.subscription.unsubscribe();
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
      case "ActiveerSelectieModus":
        return activeerSelectieModus(cmd);
      case "ToonAchtergrondKeuze":
        return toonAchtergrondkeuzeCmd(cmd);
      case "VerbergAchtergrondKeuze":
        return verbergAchtergrondkeuzeCmd(cmd);
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
      case "VoegZoekerToe":
        return voegZoekerToe(cmd);
      case "VerwijderZoeker":
        return verwijderZoeker(cmd);
      case "Zoek":
        return zoek(cmd);
      case "ZetMijnLocatieZoomStatus":
        return zetMijnLocatieZoom(cmd);
      case "VoegInteractieToe":
        return voegInteractieToe(cmd);
      case "VerwijderInteractie":
        return verwijderInteractie(cmd);
      case "VoegOverlayToe":
        return voegOverlayToe(cmd);
      case "VerwijderOverlays":
        return verwijderOverlays(cmd);
      case "ToonInfoBoodschap":
        return toonInfoBoodschap(cmd);
      case "VerbergInfoBoodschap":
        return deleteInfoBoodschap(cmd);
      case "DeselecteerFeature":
        return deselecteerFeature(cmd);
      case "SluitInfoBoodschap":
        return sluitInfoBoodschap(cmd);
      case "VoegUiElementToe":
        return voegUiElementToe(cmd);
      case "VerwijderUiElement":
        return verwijderUiElement(cmd);
      case "ZetUiElementOpties":
        return zetUiElementOpties(cmd);
    }
  };
}
