import { setoid } from "fp-ts";
import * as array from "fp-ts/lib/Array";
import { Endomorphism, Function1, Function2, identity, not, pipe } from "fp-ts/lib/function";
import * as fptsmap from "fp-ts/lib/Map";
import { fromNullable, isNone, none, option, Option, some } from "fp-ts/lib/Option";
import * as ord from "fp-ts/lib/Ord";
import { setoidString } from "fp-ts/lib/Setoid";
import * as validation from "fp-ts/lib/Validation";
import { Lens } from "monocle-ts";
import * as ol from "openlayers";
import { olx } from "openlayers";
import { Subscription } from "rxjs";
import * as rx from "rxjs";
import { bufferCount, debounceTime, distinctUntilChanged, map, switchMap, throttleTime } from "rxjs/operators";

import { FilterAanpassend, GeenFilterAanpassingBezig } from "../filter/filter-aanpassing-state";
import { Filter as fltr } from "../filter/filter-model";
import { FilterTotaal, totaalOpTeHalen } from "../filter/filter-totaal";
import { isNoSqlFsSource, NosqlFsSource } from "../source/nosql-fs-source";
import { GeenTransparantieaanpassingBezig, Transparantieaanpassend } from "../transparantieeditor/state";
import { Opaciteit, Transparantie } from "../transparantieeditor/transparantie";
import * as arrays from "../util/arrays";
import { refreshTiles } from "../util/cachetiles";
import { Feature, modifyWithLaagnaam } from "../util/feature";
import * as featureStore from "../util/indexeddb-geojson-store";
import * as metaDataDb from "../util/indexeddb-tilecache-metadata";
import * as maps from "../util/maps";
import { forEach } from "../util/option";
import * as serviceworker from "../util/serviceworker";
import { updateBehaviorSubject } from "../util/subject-update";
import { allOf, fromBoolean, fromOption, fromPredicate, success, validationChain as chain } from "../util/validation";
import { zoekerMetNaam } from "../zoeker/zoeker";

import { CachedFeatureLookup } from "./cache/lookup";
import { envParams } from "./kaart-config";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { FeatureSelection } from "./kaart-protocol";
import { MsgGen } from "./kaart-protocol-subscriptions";
import { KaartWithInfo } from "./kaart-with-info";
import { toOlLayer } from "./laag-converter";
import { kaartLogger } from "./log";
import { ModelChanger, ModelChanges, TabelStateChange } from "./model-changes";
import { findClosest } from "./select-closest";
import {
  AwvV0StyleSpec,
  getFeatureStyleSelector,
  getHoverStyleSelector,
  getSelectionStyleSelector,
  setFeatureStyleSelector,
  setHoverStyleSelector,
  setSelectionStyleSelector,
  StyleSelector
} from "./stijl-selector";
import * as ss from "./stijl-selector";
import { GeenLaagstijlaanpassing, LaagstijlAanpassend } from "./stijleditor/state";
import { getDefaultStyleSelector } from "./styles";

///////////////////////////////////
// Hulpfuncties
//

export type Model = KaartWithInfo;

export interface ModelWithResult<Msg> {
  readonly model: KaartWithInfo;
  readonly message: Option<Msg>;
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

////////////////////////
// De eigenlijke reducer
//

export function kaartCmdReducer<Msg extends prt.KaartMsg>(
  cmd: prt.Command<Msg>
): (model: Model, modelChanger: ModelChanger, modelChanges: ModelChanges, msgConsumer: prt.MessageConsumer<Msg>) => ModelWithResult<Msg> {
  return (model: Model, modelChanger: ModelChanger, modelChanges: ModelChanges, msgConsumer: prt.MessageConsumer<Msg>) => {
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
        value: some({}) // Veel ontvangers zijn niet geïnteresseerd in een specifiek resultaat, wel dat alles ok is
      };
    }

    function toModelWithValueResult<T>(
      wrapper: prt.ValidationWrapper<T, Msg>,
      resultValidation: prt.KaartCmdValidation<KaartCmdResult<T>>
    ): ModelWithResult<Msg> {
      return {
        // Als alles ok is, het nieuwe model nemen, anders het oude
        model: resultValidation.map(v => v.model).getOrElse(model),
        // Als alles ok is, dan is de message de value van KaartCmdResult, anders de foutboodschappen
        message: resultValidation.fold(fail => some(wrapper(validation.failure(fail))), v => v.value.map(x => wrapper(success(x))))
      };
    }

    // Een observer die wat er uit de observable komt verpakt in een object van type Msg en aan de msgConsumer aanbiedt.
    function consumeMessage<T>(subCmd: { wrapper: MsgGen<T, Msg> }): rx.Observer<T> {
      return {
        next: (t: T) => msgConsumer(subCmd.wrapper(t)),
        error: (err: any) => kaartLogger.error("Onverwachte fout bij kaart subscription", err),
        complete: () => kaartLogger.debug("subscription completed")
      };
    }

    function valideerToegevoegdeLaagBestaat(titel: string): prt.KaartCmdValidation<ke.ToegevoegdeLaag> {
      return fromOption(fptsmap.lookup(setoidString)(titel, model.toegevoegdeLagenOpTitel), `Een laag met titel ${titel} bestaat niet`);
    }

    function valideerToegevoegdeVectorLaagBestaat(titel: string): prt.KaartCmdValidation<ke.ToegevoegdeVectorLaag> {
      return fromOption(
        fptsmap
          .lookup(setoidString)(titel, model.toegevoegdeLagenOpTitel)
          .filter(ke.isToegevoegdeVectorLaag),
        `Een vectorlaag met titel ${titel} bestaat niet`
      );
    }

    function valideerVectorLayerBestaat(titel: string): prt.KaartCmdValidation<ol.layer.Vector> {
      return chain(valideerToegevoegdeLaagBestaat(titel), laag =>
        laag.layer["setStyle"]
          ? validation.success(laag.layer as ol.layer.Vector)
          : validation.failure([`De laag met titel ${titel} is geen vectorlaag`])
      );
    }

    function valideerNoSqlFsSourceBestaat(titel: string): prt.KaartCmdValidation<NosqlFsSource> {
      return chain(valideerVectorLayerBestaat(titel), layer => {
        const source = ke.underlyingSource(layer);
        return fromPredicate(source, isNoSqlFsSource, `De laag met titel ${titel} is geen NoSqlFslaag`);
      });
    }

    function valideerTiledWmsBestaat(titel: string): prt.KaartCmdValidation<ol.layer.Tile> {
      return chain(valideerToegevoegdeLaagBestaat(titel), laag =>
        fromPredicate(laag.layer as ol.layer.Tile, () => ke.isTiledWmsLaag(laag.bron), `Laag ${laag.bron.titel} is geen tiled WMS laag`)
      );
    }

    function valideerLaagTitelBestaatNiet(titel: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(model, (mdl: Model) => !mdl.toegevoegdeLagenOpTitel.has(titel), `Een laag met titel ${titel} bestaat al`);
    }

    function valideerZoekerIsNietGeregistreerd(naam: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(
        model,
        (mdl: Model) => zoekerMetNaam(naam)(mdl.zoekersMetPrioriteiten).isNone(),
        `Een zoeker met naam ${naam} bestaat al`
      );
    }

    function valideerZoekerIsGeregistreerd(naam: string): prt.KaartCmdValidation<{}> {
      return fromPredicate(
        model,
        (mdl: Model) => zoekerMetNaam(naam)(mdl.zoekersMetPrioriteiten).isSome(),
        `Een zoeker met naam ${naam} bestaat niet`
      );
    }

    function valideerMinstens1ZoekerGeregistreerd(): prt.KaartCmdValidation<{}> {
      return fromPredicate(
        model,
        (mdl: Model) => mdl.zoekersMetPrioriteiten.length >= 1, //
        `Er moet minstens 1 zoeker geregistreerd zijn`
      );
    }

    const valideerIsAchtergrondLaag: Function1<string, prt.KaartCmdValidation<{}>> = titel =>
      fromBoolean(model.groepOpTitel.get(titel) === "Achtergrond", "De laag is geen achtergrondlaag");

    const valideerIsVoorgrondlaag: Function1<ke.ToegevoegdeLaag, prt.KaartCmdValidation<ke.ToegevoegdeLaag>> = laag =>
      fromPredicate(
        laag,
        (lg: ke.ToegevoegdeLaag) => lg.laaggroep === "Voorgrond.Hoog" || lg.laaggroep === "Voorgrond.Laag",
        "De laag is geen voorgrondlaag"
      );

    const valideerAlsLayer: Function1<ke.Laag, prt.KaartCmdValidation<ol.layer.Base>> = laag =>
      fromOption(toOlLayer(model, laag), "De laagbeschrijving kon niet naar een openlayers laag omgezet worden");

    const valideerAlsStijlSpec: Function1<AwvV0StyleSpec, prt.KaartCmdValidation<ss.Stylish>> = ss.validateAwvV0StyleSpec;

    const pasLaagPositieAan: Function1<number, Endomorphism<ke.ToegevoegdeLaag>> = positieAanpassing => laag => {
      const positie = laag.positieInGroep + positieAanpassing;
      zetLayerIndex(laag.layer, positie, laag.laaggroep);
      return { ...laag, positieInGroep: positie };
    };

    const pasVectorLaagStijlToe: (lg: ke.ToegevoegdeVectorLaag) => void = laag => {
      // Er moet een stijl zijn voor het tekenen van de features op de kaart
      const featureStyleSelector = laag.stijlSel.getOrElse(getDefaultStyleSelector());
      // Maar er moet geen specifieke stijl zijn voor het selecteren van een feature. Als er geen is, dan wordt er teruggevallen
      // op een gemodificeerde stijl tijdens het tekenen van selectie.
      const toOffset: Endomorphism<ss.StyleSelector> = laag.bron.offsetveld.fold(
        identity, // als er geen offsetveld is, dan hoeven we niks te doen
        offsetveld => ss.offsetStyleSelector("ident8", offsetveld, laag.stijlPositie, laag.bron.rijrichtingIsDigitalisatieZin)
      );
      const offsetFeatureStyleSelector = toOffset(featureStyleSelector);

      laag.layer.setStyle(ss.toStylish(offsetFeatureStyleSelector));

      setFeatureStyleSelector(model.map, laag.titel, some(offsetFeatureStyleSelector));
      setSelectionStyleSelector(model.map, laag.titel, laag.selectiestijlSel.map(toOffset));
      setHoverStyleSelector(model.map, laag.titel, laag.hoverstijlSel.map(toOffset));
    };

    const pasVectorLaagStijlAan: Function2<Option<ss.StyleSelector>, Option<ss.StyleSelector>, Endomorphism<ke.ToegevoegdeVectorLaag>> = (
      maybeStijlSel,
      maybeSelectieStijlSel
    ) => laag => {
      const updatedLaag = { ...laag, stijlSel: maybeStijlSel, selectiestijlSel: maybeSelectieStijlSel };
      pasVectorLaagStijlToe(updatedLaag); // expliciet als side-effect opgeroepen
      return updatedLaag;
    };

    // Bij de vectorlagen moeten we ook de (mogelijk aanwezige) stylefuncties aanpassen
    // De manier waarop de stijlpositie aangepast wordt is niet correct als er in de groep ook lagen zitten die geen vectorlaag zijn!
    const pasVectorLaagStijlPositieAan: Function1<number, Endomorphism<ke.ToegevoegdeLaag>> = positieAanpassing => laag => {
      return ke
        .asToegevoegdeVectorLaag(laag)
        .map<ke.ToegevoegdeLaag>(tvl =>
          pasVectorLaagStijlAan(tvl.stijlSel, tvl.selectiestijlSel)({ ...tvl, stijlPositie: tvl.stijlPositie + positieAanpassing })
        )
        .getOrElse(laag);
    };

    /**
     * Alle lagen in een gegeven bereik van z-indices aanpassen. Belangrijk om bij toevoegen, verwijderen en verplaatsen,
     * alle z-indices in een aaneengesloten interval te behouden.
     */
    function pasLaagPositiesAan(positieAanpassing: number, vanaf: number, tot: number, groep: ke.Laaggroep): Model {
      return lagenInGroep(model, groep).reduce((mdl, laag) => {
        const groepPositie = layerIndexNaarGroepIndex(laag!.layer, groep);
        if (groepPositie >= vanaf && groepPositie <= tot && positieAanpassing !== 0) {
          const positie = groepPositie + positieAanpassing;
          return pipe(
            pasVectorLaagStijlPositieAan(positieAanpassing),
            pasLaagPositieAan(positieAanpassing),
            pasLaagInModelAan(mdl!)
          )(laag! as ke.ToegevoegdeVectorLaag);
        } else {
          return mdl!;
        }
      }, model);
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

    function lagenInGroep(mdl: Model, groep: ke.Laaggroep): Array<ke.ToegevoegdeLaag> {
      const maybeTitels: Option<string[]> = fptsmap.lookup(setoidString)(groep, mdl.titelsOpGroep);
      const maybeLagen: Option<ke.ToegevoegdeLaag[]> = maybeTitels.chain(titels =>
        array.array.traverse(option)(titels, titel => fptsmap.lookup(setoidString)(titel, mdl.toegevoegdeLagenOpTitel))
      );
      return arrays.fromOption(maybeLagen);
    }

    const ordToegevoegdeLaag: ord.Ord<ke.ToegevoegdeLaag> = ord.contramap(laag => -laag!.layer.getZIndex(), ord.ordNumber);

    function zendLagenInGroep(mdl: Model, groep: ke.Laaggroep): void {
      modelChanger.lagenOpGroepSubj[groep].next(
        array.sort(ordToegevoegdeLaag)(lagenInGroep(mdl, groep)) // en dus ook geldige titels
      );
    }

    function zendStijlwijziging(laag: ke.ToegevoegdeVectorLaag): void {
      modelChanger.laagstijlGezetSubj.next(laag);
    }

    function zendFilterwijziging(laag: ke.ToegevoegdeVectorLaag): void {
      modelChanger.laagfilterGezetSubj.next(laag);
    }

    function zetLayerIndex(layer: ol.layer.Base, groepIndex: number, groep: ke.Laaggroep): void {
      layer.setZIndex(groepIndexNaarZIndex(groepIndex, groep));
    }

    function limitPosition(position: number, groep: ke.Laaggroep) {
      // laat 1 positie voorbij het einde toe om laag kunnen toe te voegen
      return Math.max(0, Math.min(position, model.titelsOpGroep.get(groep)!.length));
    }

    function abortTileLoadingCmd(cmnd: prt.AbortTileLoadingCmd) {
      model.tileLoader.abort();
      return ModelWithResult(model, none);
    }

    function vectorLaagPositie(groepPositie: number, groep: ke.Laaggroep): number {
      return lagenInGroep(model, groep).filter(tlg => ke.isVectorLaag(tlg!.bron) && tlg!.positieInGroep < groepPositie).length;
    }

    /**
     * Een laag toevoegen. Faalt als er al een laag met die titel bestaat.
     */
    function voegLaagToeCmd(cmnd: prt.VoegLaagToeCmd<Msg>): ModelWithResult<Msg> {
      return fromNullable(model.toegevoegdeLagenOpTitel.get(cmnd.laag.titel)).foldL(
        () => {
          return toModelWithValueResult(
            cmnd.wrapper,
            valideerAlsLayer(cmnd.laag).map(layer => {
              const titel = cmnd.laag.titel;
              const groep = cmnd.laaggroep;
              const groepPositie = limitPosition(cmnd.positie, groep);
              const modelMetAangepasteLagen = pasLaagPositiesAan(1, groepPositie, maxIndexInGroep(groep), groep);
              const toegevoegdeLaagCommon: ke.ToegevoegdeLaag = {
                bron: cmnd.laag,
                layer: layer,
                titel: cmnd.laag.titel,
                laaggroep: groep,
                positieInGroep: groepPositie,
                magGetoondWorden: cmnd.magGetoondWorden,
                transparantie: cmnd.transparantie,
                legende: cmnd.legende,
                stijlInLagenKiezer: cmnd.stijlInLagenKiezer
              };
              const toegevoegdeVectorLaagCommon: ke.ToegevoegdeLaag = ke.asVectorLaag(cmnd.laag).fold(
                toegevoegdeLaagCommon, //
                vlg => ({
                  ...toegevoegdeLaagCommon,
                  bron: vlg,
                  layer: layer as ol.layer.Vector, // veilig omdat laag een VectorLaag is
                  stijlPositie: vectorLaagPositie(groepPositie, groep),
                  stijlSel: vlg.styleSelector,
                  stijlSelBron: vlg.styleSelectorBron,
                  selectiestijlSel: vlg.selectieStyleSelector,
                  hoverstijlSel: vlg.hoverStyleSelector,
                  filterinstellingen: cmnd.filterinstellingen.getOrElse(ke.stdLaagfilterinstellingen)
                })
              );
              const toegevoegdeLaag: ke.ToegevoegdeLaag = ke.asToegevoegdeNosqlVectorLaag(toegevoegdeVectorLaagCommon).fold(
                toegevoegdeVectorLaagCommon, //
                tgnslg => {
                  const [filter, actief] = cmnd.filterinstellingen.fold<[fltr.Filter, boolean]>([fltr.empty(), false], fi => [
                    fi.spec,
                    fi.actief
                  ]);
                  // NosqlFsSource is mutable
                  const source = ke.underlyingSource(tgnslg.layer);
                  (source as NosqlFsSource).setUserFilter(filter, actief);
                  return tgnslg;
                }
              );
              layer.set(ke.LayerProperties.Titel, titel);
              layer.setVisible(cmnd.magGetoondWorden && !cmnd.laag.verwijderd); // achtergrondlagen expliciet zichtbaar maken!
              layer.setOpacity(
                pipe(
                  Transparantie.toOpaciteit,
                  Opaciteit.toNumber
                )(cmnd.transparantie)
              );
              // met positie hoeven we nog geen rekening te houden
              forEach(ke.asToegevoegdeVectorLaag(toegevoegdeLaag), pasVectorLaagStijlToe);
              zetLayerIndex(layer, groepPositie, groep);
              forEach(ke.asToegevoegdeNosqlVectorLaag(toegevoegdeLaag).filter(tnl => tnl.filterinstellingen.actief), zendFilterwijziging);
              forEach(
                ke.asToegevoegdeNosqlVectorLaag(toegevoegdeLaag).filter(tnl => fltr.isDefined(tnl.filterinstellingen.spec)),
                berekenFilterTotalen
              );

              model.map.addLayer(layer);
              const updatedModel = {
                ...modelMetAangepasteLagen,
                toegevoegdeLagenOpTitel: modelMetAangepasteLagen.toegevoegdeLagenOpTitel.set(titel, toegevoegdeLaag), // TODO immutable!
                titelsOpGroep: modelMetAangepasteLagen.titelsOpGroep.set(groep, model.titelsOpGroep.get(groep)!.concat([titel])),
                groepOpTitel: modelMetAangepasteLagen.groepOpTitel.set(titel, groep)
              };
              zendLagenInGroep(updatedModel, cmnd.laaggroep);
              return ModelAndEmptyResult(updatedModel);
            })
          );
        },
        bestaandeLaag => {
          if (bestaandeLaag.magGetoondWorden) {
            return ModelWithResult(model);
          } else {
            return maakLaagZichtbaarCmd(prt.MaakLaagZichtbaarCmd(bestaandeLaag.titel, cmnd.wrapper));
          }
        }
      );
    }
    function verwijderGeselecteerdeFeaturesVanLaag(laagnaam: string) {
      // Als er features van onze laag geselecteerd waren, moeten we die verwijderen uit de door ol gemanagede collection.
      const teVerwijderenGeselecteerdeFeatures = model.geselecteerdeFeatures.features
        .getArray()
        .filter(feature => Feature.getLaagnaam(feature).exists(ln => ln === laagnaam));
      teVerwijderenGeselecteerdeFeatures.forEach(feature => model.geselecteerdeFeatures.features.remove(feature));
    }

    /**
     * Een laag verwijderen. De titel van de laag bepaalt welke er verwijderd wordt.
     */
    function verwijderLaagCmd(cmnd: prt.VerwijderLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerToegevoegdeLaagBestaat(cmnd.titel).map(laag => {
          const layer = laag.layer;
          model.map.removeLayer(layer); // Oesje. Side-effect. Gelukkig idempotent.
          verwijderGeselecteerdeFeaturesVanLaag(cmnd.titel);
          const titel = cmnd.titel;
          const groep = laag.laaggroep;
          const modelMetAangepasteLagen = pasLaagPositiesAan(-1, layerIndexNaarGroepIndex(layer, groep) + 1, maxIndexInGroep(groep), groep);
          const updatedModel = {
            ...modelMetAangepasteLagen,
            toegevoegdeLagenOpTitel: fptsmap.remove(setoidString)(titel, modelMetAangepasteLagen.toegevoegdeLagenOpTitel),
            titelsOpGroep: modelMetAangepasteLagen.titelsOpGroep.set(
              groep,
              modelMetAangepasteLagen.titelsOpGroep.get(groep)!.filter(t => t !== titel)
            ),
            groepOpTitel: fptsmap.remove(setoidString)(titel, modelMetAangepasteLagen.groepOpTitel)
          };
          zendLagenInGroep(updatedModel, groep);
          modelChanger.laagVerwijderdSubj.next(laag);
          ss.clearFeatureStyleSelector(model.map, laag.titel);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function vervangLaag(cmnd: prt.VervangLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        chain(valideerToegevoegdeLaagBestaat(cmnd.laag.titel), laag => valideerAlsLayer(cmnd.laag).map(layer => [laag, layer])).map(
          ([laag, layer]: [ke.ToegevoegdeLaag, ol.layer.Base]) => {
            const toegevoegdeLaagCommon: ke.ToegevoegdeLaag = {
              bron: cmnd.laag,
              layer: layer,
              titel: laag.titel,
              laaggroep: laag.laaggroep,
              positieInGroep: laag.positieInGroep,
              magGetoondWorden: laag.magGetoondWorden,
              transparantie: laag.transparantie,
              legende: laag.legende,
              stijlInLagenKiezer: laag.stijlInLagenKiezer
            };
            const toegevoegdeLaag = ke
              .asVectorLaag(cmnd.laag)
              .map<ke.ToegevoegdeLaag>(vlg => ({
                ...toegevoegdeLaagCommon,
                stijlPositie: vectorLaagPositie(laag.positieInGroep, laag.laaggroep),
                stijlSel: vlg.styleSelector,
                selectiestijlSel: vlg.selectieStyleSelector,
                hoverstijlSel: vlg.hoverStyleSelector,
                filterinstellingen: ke.stdLaagfilterinstellingen
              }))
              .getOrElse(toegevoegdeLaagCommon);
            const oldLayer = laag.layer;
            layer.set(ke.LayerProperties.Titel, oldLayer.get(ke.LayerProperties.Titel));
            layer.setVisible(oldLayer.getVisible());
            layer.setOpacity(oldLayer.getOpacity());
            forEach(ke.asToegevoegdeVectorLaag(toegevoegdeLaag), pasVectorLaagStijlToe);
            zetLayerIndex(layer, laag.positieInGroep, laag.laaggroep);
            model.map.addLayer(layer);
            model.map.removeLayer(oldLayer);
            const updatedModel = pasLaagInModelAan(model)(toegevoegdeLaag);
            zendLagenInGroep(updatedModel, toegevoegdeLaag.laaggroep);
            return ModelAndEmptyResult(updatedModel);
          }
        )
      );
    }

    function zetLaagLegende(cmnd: prt.ZetLaagLegendeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerToegevoegdeLaagBestaat(cmnd.titel).map(laag => {
          const laagMetLegende = { ...laag, legende: some(cmnd.legende) };
          const updatedModel = pasLaagInModelAan(model)(laagMetLegende);
          zendLagenInGroep(updatedModel, laagMetLegende.laaggroep);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function verplaatsLaagCmd(cmnd: prt.VerplaatsLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        chain(
          valideerToegevoegdeLaagBestaat(cmnd.titel), //
          valideerIsVoorgrondlaag // enkel zinvol om voorgrondlagen te verplaatsen
        ).map(laag => {
          const titel = cmnd.titel;
          const groep = model.groepOpTitel.get(titel)!;
          const vanPositie = layerIndexNaarGroepIndex(laag.layer, groep);
          const naarPositie = limitPosition(cmnd.naarPositie, groep); // uitgedrukt in z-index waarden
          // Afhankelijk of we van onder naar boven of van boven naar onder verschuiven, moeten de tussenliggende lagen
          // naar onder, resp. naar boven verschoven worden.
          const modelMetAangepasteLagen =
            vanPositie < naarPositie
              ? pasLaagPositiesAan(-1, vanPositie + 1, naarPositie, groep)
              : pasLaagPositiesAan(1, naarPositie, vanPositie - 1, groep);

          // En ook de te verplaatsen laag moet een andere positie krijgen uiteraard
          const updatedModel = pipe(
            pasVectorLaagStijlPositieAan(naarPositie - vanPositie),
            pasLaagPositieAan(naarPositie - vanPositie),
            pasLaagInModelAan(modelMetAangepasteLagen)
          )(laag);

          // Deselect en selecteer alle features om terug een correcte offset rendering te krijgen
          // Indien OL geupgrade kunnen we dit eleganter doen door de stijl van de features op de overlay laag aan te passen, zie:
          // https://openlayers.org/en/latest/apidoc/module-ol_interaction_Select-Select.html#getOverlay
          const geselecteerd = [...model.geselecteerdeFeatures.features.getArray()];
          model.geselecteerdeFeatures.features.clear();
          model.geselecteerdeFeatures.features.extend(geselecteerd);

          zendLagenInGroep(updatedModel, groep);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function vraagSchaalAan(cmnd: prt.VraagSchaalAanCmd<Msg>): ModelWithResult<Msg> {
      modelChanger.uiElementSelectieSubj.next({ naam: "Schaal", aan: true });
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.schaal, isNone, "De schaal is al toegevoegd").map(() => ModelAndEmptyResult({ ...model }))
      );
    }

    function voegSchaalToeCmd(cmnd: prt.VoegSchaalToeCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.schaal, isNone, "De schaal is al toegevoegd").map(() => {
          const schaal = cmnd.target
            .map(t => new ol.control.ScaleLine({ className: "awv-schaal", target: t, minWidth: 40 }))
            .getOrElseL(() => new ol.control.ScaleLine({ className: "awv-schaal" }));
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
        fromPredicate(model.stdInteracties, array.isEmpty, "De standaard interacties zijn al ingesteld").map(() => {
          const stdInteracties: ol.interaction.Interaction[] = ol.interaction
            .defaults()
            .getArray()
            .filter(
              interaction =>
                !(
                  (!cmnd.rotatie && interaction instanceof ol.interaction.DragRotate) ||
                  (!cmnd.rotatie && interaction instanceof ol.interaction.PinchRotate) ||
                  interaction instanceof ol.interaction.MouseWheelZoom
                ) // we willen zelf de opties op MouseWheelZoom zetten
            )
            .concat(
              [new ol.interaction.MouseWheelZoom({ constrainResolution: true })] // Geen fractionele resoluties!
            );
          stdInteracties.forEach(i => model.map.addInteraction(i!)); // side effects :-(
          const newModel: Model = { ...model, stdInteracties: stdInteracties, scrollZoomOnFocus: cmnd.scrollZoomOnFocus };
          activateMouseWheelZoomIfAllowed(!cmnd.scrollZoomOnFocus, newModel);
          return ModelAndEmptyResult(newModel);
        })
      );
    }

    function verwijderStandaardInteractiesCmd(cmnd: prt.VerwijderStandaardInteractiesCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        fromPredicate(model.stdInteracties, not(array.isEmpty), "De standaard interacties zijn niet aanwezig").map(
          (stdInteracties: Array<ol.interaction.Interaction>) => {
            stdInteracties.forEach(i => model.map.removeInteraction(i!));
            return ModelAndEmptyResult({ ...model, stdInteracties: [] });
          }
        )
      );
    }

    function veranderMiddelpuntCmd(cmnd: prt.VeranderMiddelpuntCmd): ModelWithResult<Msg> {
      model.map.getView().animate({
        center: cmnd.coordinate,
        duration: cmnd.animationDuration.getOrElse(0)
      });
      return ModelWithResult(model);
    }

    function veranderZoomniveauCmd(cmnd: prt.VeranderZoomCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        success(cmnd.zoom).map(zoom => {
          model.map.getView().setZoom(zoom);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function veranderRotatieCmd(cmnd: prt.VeranderRotatieCmd): ModelWithResult<Msg> {
      model.map.getView().animate({
        rotation: cmnd.rotatie,
        duration: cmnd.animationDuration.getOrElse(0)
      });
      return ModelWithResult(model);
    }

    function veranderExtentCmd(cmnd: prt.VeranderExtentCmd): ModelWithResult<Msg> {
      model.map.getView().fit(cmnd.extent);
      return ModelWithResult(model);
    }

    function veranderViewportCmd(cmnd: prt.VeranderViewportCmd): ModelWithResult<Msg> {
      // Openlayers moet weten dat de grootte van de container aangepast is of de kaart is uitgerekt
      model.map.setSize([cmnd.size[0]!, cmnd.size[1]!]); // OL kan wel degelijk undefined aan, maar de declaratie beweert anders
      model.map.updateSize();
      modelChanger.viewPortSizeSubj.next(null); // Omdat extent wschl gewijzigd wordt
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

    function highlightFeaturesCmd(cmnd: prt.HighlightFeaturesCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerVectorLayerBestaat(cmnd.titel).map(layer => {
          model.highlightedFeatures.clear();
          model.highlightedFeatures.extend(
            layer
              .getSource()
              .getFeatures()
              .filter(cmnd.selector)
          );
          return ModelAndEmptyResult(model);
        })
      );
    }

    function vervangFeaturesCmd(cmnd: prt.VervangFeaturesCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerVectorLayerBestaat(cmnd.titel).map(layer => {
          const layerSource = layer.getSource();
          const source = layerSource instanceof ol.source.Cluster ? layerSource.getSource() : layerSource;
          if (!arrays.isEmpty(source.getFeatures())) {
            // Zit binnen een conditie omdat we onnodigie OL events willen voorkomen
            source.clear(false);
          }
          if (!arrays.isEmpty(cmnd.features)) {
            // Zit binnen een conditie omdat we onnodigie OL events willen voorkomen
            source.addFeatures(cmnd.features.map(modifyWithLaagnaam(cmnd.titel)));
          }
          return ModelAndEmptyResult(model);
        })
      );
    }

    // Lensaardig met side-effect
    const pasLaagZichtbaarheidAan: (toon: boolean) => Endomorphism<ke.ToegevoegdeLaag> = magGetoondWorden => laag => {
      laag.layer.setVisible(magGetoondWorden);
      return laag.magGetoondWorden === magGetoondWorden ? laag : { ...laag, magGetoondWorden: magGetoondWorden };
    };

    const pasLaagFilterAan: (spec: fltr.Filter, actief: boolean, totaal: FilterTotaal) => Endomorphism<ke.ToegevoegdeVectorLaag> = (
      spec,
      actief,
      totaal
    ) =>
      Lens.fromProp<ke.ToegevoegdeVectorLaag, "filterinstellingen">("filterinstellingen").set(
        ke.Laagfilterinstellingen(spec, actief, totaal)
      );

    // Uiteraard is het *nooit* de bedoeling om de titel van een laag aan te passen.
    const pasLaagInModelAan: (mdl: Model) => (laag: ke.ToegevoegdeLaag) => Model = mdl => laag => ({
      ...mdl,
      toegevoegdeLagenOpTitel: mdl.toegevoegdeLagenOpTitel.set(laag.titel, laag)
    });

    function toonAchtergrondkeuzeCmd(cmnd: prt.ToonAchtergrondKeuzeCmd<Msg>): ModelWithResult<Msg> {
      const achtergrondTitels = model.titelsOpGroep.get("Achtergrond")!;
      return toModelWithValueResult(
        cmnd.wrapper,
        allOf([
          fromBoolean(!model.showBackgroundSelector, "De achtergrondkeuze is al actief"),
          fromBoolean(!array.isEmpty(achtergrondTitels), "Er moet minstens 1 achtergrondlaag zijn")
        ]).map(() => {
          const achtergrondLagen: Array<ke.ToegevoegdeLaag> = model.titelsOpGroep
            .get("Achtergrond")!
            .map(titel => model.toegevoegdeLagenOpTitel.get(titel!)!); // de titels bestaan bij constructie
          const geselecteerdeLaag = fromNullable(achtergrondLagen.find(laag => laag!.magGetoondWorden));
          const teSelecterenLaag = geselecteerdeLaag.getOrElseL(() => achtergrondLagen[0]); // er is er minstens 1 wegens validatie

          // Zorg ervoor dat er juist 1 achtergrondlaag zichtbaar is
          const modelMetAangepasteLagen = achtergrondLagen.reduce(
            (mdl, laag) =>
              pipe(
                pasLaagZichtbaarheidAan(laag!.titel === teSelecterenLaag.titel),
                pasLaagInModelAan(mdl!)
              )(laag!),
            model
          );

          model.achtergrondlaagtitelSubj.next(teSelecterenLaag.titel);
          modelChanger.uiElementSelectieSubj.next({ naam: "Achtergrondkeuze", aan: true });
          zendLagenInGroep(modelMetAangepasteLagen, "Achtergrond");
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
        chain(
          valideerIsAchtergrondLaag(cmnd.titel), //
          () => valideerToegevoegdeLaagBestaat(cmnd.titel)
        ).map((nieuweAchtergrond: ke.ToegevoegdeLaag) => {
          model.achtergrondlaagtitelSubj.next(cmnd.titel);
          const maybeVorigeAchtergrond = maps.findFirst(
            model.toegevoegdeLagenOpTitel,
            laag => laag!.laaggroep === "Achtergrond" && laag!.magGetoondWorden
          );
          const modelMetNieuweZichtbaarheid = pipe(
            pasLaagZichtbaarheidAan(true),
            pasLaagInModelAan(model)
          )(nieuweAchtergrond);
          const modelMetNieuweEnOudeZichtbaarheid = maybeVorigeAchtergrond
            .filter(vorige => vorige.titel !== nieuweAchtergrond.titel) // enkel onzichtbaar maken als verschillend
            .fold(
              modelMetNieuweZichtbaarheid, //
              vorigeAchtergrond =>
                pipe(
                  pasLaagZichtbaarheidAan(false),
                  pasLaagInModelAan(modelMetNieuweZichtbaarheid)
                )(vorigeAchtergrond)
            );
          zendLagenInGroep(modelMetNieuweEnOudeZichtbaarheid, "Achtergrond");
          return ModelAndEmptyResult(modelMetNieuweEnOudeZichtbaarheid);
        })
      );
    }

    function maakLaagZichtbaarCmd(cmnd: prt.MaakLaagZichtbaarCmd<Msg>): ModelWithResult<Msg> {
      return zetLaagZichtbaarheid(cmnd.titel, true, cmnd.wrapper);
    }

    function maakLaagOnzichtbaarCmd(cmnd: prt.MaakLaagOnzichtbaarCmd<Msg>): ModelWithResult<Msg> {
      verwijderGeselecteerdeFeaturesVanLaag(cmnd.titel);
      return zetLaagZichtbaarheid(cmnd.titel, false, cmnd.wrapper);
    }

    function zetLaagZichtbaarheid(titel: string, magGetoondWorden: boolean, wrapper: prt.BareValidationWrapper<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        wrapper,
        valideerToegevoegdeLaagBestaat(titel).map(laag => {
          const aangepastModel = pipe(
            pasLaagZichtbaarheidAan(magGetoondWorden),
            pasLaagInModelAan(model)
          )(laag);
          zendLagenInGroep(aangepastModel, laag.laaggroep);
          return ModelAndEmptyResult(aangepastModel);
        })
      );
    }

    function zetLaagSelecteerbaarCmd(cmnd: prt.ZetLaagSelecteerbaarCmd<Msg>): ModelWithResult<Msg> {
      // ke.LayerProperties.Selecteerbaar is een custom property op alle lagen die wij toegevoegd hebben. Het wordt
      // gebruikt als filterfunctie bij Select interacties. Het is niet duidelijk uit de documentatie of die filter elke
      // keer geëvalueerd wordt bij elke selectie of eenmaal tijdens de initialisatie van de interactie. Uit de source
      // code echter blijkt dit voor elke selectie event te zijn. We mogen dus verwachten dat
      // ke.LayerProperties.Selecteerbaar zetten op een laag onmiddellijk effect heeft.
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerToegevoegdeVectorLaagBestaat(cmnd.titel).map(laag => {
          laag.layer.set(ke.LayerProperties.Selecteerbaar, cmnd.selecteerbaar);
          return ModelAndEmptyResult(model);
        })
      );
    }

    const applySelectionColor: Endomorphism<ol.style.Style> = function(style: ol.style.Style): ol.style.Style {
      // TODO ipv dit gepruts op het niveau van OL zou het veel makkelijker en veiliger zijn om met lenzen op een AwvV0StyleSpec te werken
      const selectionStrokeColor: ol.Color = [0, 153, 255, 1]; // TODO maak configureerbaar
      const selectionFillColor: ol.Color = [112, 198, 255, 0.7]; // TODO maak configureerbaar
      const selectionIconColor: ol.Color = [0, 51, 153, 0.7]; // TODO maak configureerbaar

      const selectionStyle = style.clone();
      if (selectionStyle.getStroke()) {
        selectionStyle.getStroke().setColor(selectionStrokeColor);
      }
      if (selectionStyle.getFill()) {
        selectionStyle.getFill().setColor(selectionFillColor);
      }
      if (selectionStyle.getImage()) {
        // getekende Point objecten ook inkleuren
        if (selectionStyle.getImage() instanceof ol.style.Circle) {
          const circle = selectionStyle.getImage() as ol.style.Circle;
          forEach(fromNullable(circle.getStroke()), stroke => stroke.setColor(selectionStrokeColor));
          forEach(fromNullable(circle.getFill()), fill => fill.setColor(selectionFillColor));
          // volgende is nodig, anders heeft style aanpassing geen effect
          selectionStyle.setImage(
            new ol.style.Circle({
              radius: circle.getRadius(),
              stroke: circle.getStroke(),
              fill: circle.getFill(),
              snapToPixel: circle.getSnapToPixel()
            })
          );
        } else if (selectionStyle.getImage() instanceof ol.style.RegularShape) {
          const shape = selectionStyle.getImage() as ol.style.RegularShape;
          forEach(fromNullable(shape.getStroke()), stroke => stroke.setColor(selectionStrokeColor));
          forEach(fromNullable(shape.getFill()), fill => fill.setColor(selectionFillColor));
          // volgende is nodig, anders heeft style aanpassing geen effect
          selectionStyle.setImage(
            new ol.style.RegularShape({
              fill: shape.getFill(),
              points: shape.getPoints(),
              radius: shape.getRadius(),
              radius1: shape.getRadius(),
              radius2: shape.getRadius2(),
              angle: shape.getAngle(),
              snapToPixel: shape.getSnapToPixel(),
              stroke: shape.getStroke(),
              rotation: shape.getRotation()
            })
          );
        } else if (selectionStyle.getImage() instanceof ol.style.Icon) {
          const icon = selectionStyle.getImage() as ol.style.Icon;
          selectionStyle.setImage(
            new ol.style.Icon({
              color: selectionIconColor,
              src: icon.getSrc(),
              size: icon.getSize()
            })
          );
        }
      }
      return selectionStyle;
    };

    type FeatureStyle = ol.style.Style | ol.style.Style[];
    type LaagTitel = string;

    const noStyle: FeatureStyle = [];

    type StyleSelectorFn = Function2<ol.Map, LaagTitel, Option<StyleSelector>>;

    const createSelectionStyleFn = function(styleSelectorFn: StyleSelectorFn): ol.StyleFunction {
      return function(feature: ol.Feature, resolution: number): FeatureStyle {
        const executeStyleSelector: (_: ss.StyleSelector) => FeatureStyle = ss.matchStyleSelector(
          (s: ss.StaticStyle) => s.style,
          (s: ss.DynamicStyle) => s.styleFunction(feature, resolution)!,
          (s: ss.Styles) => s.styles
        );

        return Feature.getLaagnaam(feature).foldL(
          () => {
            kaartLogger.warn("Geen laagnaam gevonden voor: ", feature);
            return noStyle;
          },
          laagnaam =>
            styleSelectorFn(model.map, laagnaam).foldL(
              () => {
                kaartLogger.debug("Geen hover/selectiestijl gevonden voor:", feature);
                return getFeatureStyleSelector(model.map, laagnaam).foldL<FeatureStyle>(
                  () => {
                    kaartLogger.error("Geen stijlselector gevonden voor:", feature);
                    return noStyle;
                  },
                  pipe(
                    executeStyleSelector,
                    applySelectionColor
                  ) // we vallen terug op feature stijl met custom kleurtje
                );
              },
              executeStyleSelector // dit is het perfecte geval: evalueer de selectiestijl selector
            )
        );
      };
    };

    function activeerSelectieModus(cmnd: prt.ActiveerSelectieModusCmd): ModelWithResult<Msg> {
      function getSelectInteraction(modus: prt.SelectieModus): Option<olx.interaction.SelectOptions> {
        const hitTolerance = envParams(model.config).clickHitTolerance;
        switch (modus) {
          case "singleQuick":
            return some({
              condition: ol.events.condition.click,
              features: model.geselecteerdeFeatures.features,
              multi: false,
              style: createSelectionStyleFn(getSelectionStyleSelector),
              hitTolerance: hitTolerance,
              layers: layer => layer.get(ke.LayerProperties.Selecteerbaar)
            });
          case "single":
            return some({
              condition: ol.events.condition.click,
              toggleCondition: ol.events.condition.click,
              features: model.geselecteerdeFeatures.features,
              multi: true, // true voor single, maar event handler wat lager houdt enkel 1 feature over
              style: createSelectionStyleFn(getSelectionStyleSelector),
              hitTolerance: hitTolerance,
              layers: layer => layer.get(ke.LayerProperties.Selecteerbaar)
            });
          case "multipleShift":
            return some({
              condition: ol.events.condition.click,
              features: model.geselecteerdeFeatures.features,
              multi: true,
              style: createSelectionStyleFn(getSelectionStyleSelector),
              hitTolerance: hitTolerance,
              layers: layer => layer.get(ke.LayerProperties.Selecteerbaar)
            });
          case "multipleKlik":
            return some({
              condition: ol.events.condition.click,
              toggleCondition: ol.events.condition.click,
              features: model.geselecteerdeFeatures.features,
              multi: true,
              style: createSelectionStyleFn(getSelectionStyleSelector),
              hitTolerance: hitTolerance,
              layers: layer => layer.get(ke.LayerProperties.Selecteerbaar)
            });
          case "none":
          default:
            return none;
        }
      }

      const newSelectInteracties = arrays.fromOption(
        getSelectInteraction(cmnd.selectieModus).map(selectOption => {
          const selectInteraction = new ol.interaction.Select(selectOption);

          if (cmnd.selectieModus === "single") {
            selectInteraction.on("select", (s: ol.interaction.Select.Event) => {
              const selectedFeaturesCollection = s.target.getFeatures();
              const selectedFeatures = selectedFeaturesCollection.getArray();
              if (arrays.isNonEmpty(selectedFeatures)) {
                const maybeClosest = findClosest(selectedFeatures, s.mapBrowserEvent.coordinate);
                selectedFeaturesCollection.clear();
                forEach(maybeClosest, closest => selectedFeaturesCollection.extend([closest]));
              }
            });
          }

          return [
            selectInteraction,
            new ol.interaction.DragBox({
              condition: ol.events.condition.platformModifierKeyOnly
            })
          ];
        })
      );

      model.selectInteracties.forEach(i => model.map.removeInteraction(i));
      newSelectInteracties.forEach(i => model.map.addInteraction(i));

      return ModelWithResult({ ...model, selectInteracties: newSelectInteracties });
    }

    function deactiveerSelectieModus(cmnd: prt.DeactiveerSelectieModusCmd): ModelWithResult<Msg> {
      model.selectInteracties.forEach(i => model.map.removeInteraction(i));
      return ModelWithResult(model);
    }

    function reactiveerSelectieModus(cmnd: prt.ReactiveerSelectieModusCmd): ModelWithResult<Msg> {
      model.selectInteracties.forEach(i => model.map.addInteraction(i));
      return ModelWithResult(model);
    }

    function activeerHoverModus(cmnd: prt.ActiveerHoverModusCmd): ModelWithResult<Msg> {
      function getHoverInteraction(modus: prt.HoverModus): Option<olx.interaction.SelectOptions> {
        switch (modus) {
          case "on":
            return some({
              condition: ol.events.condition.pointerMove,
              features: model.hoverFeatures,
              style: createSelectionStyleFn(getHoverStyleSelector),
              layers: layer => layer.get(ke.LayerProperties.Hover)
            });
          case "off":
            return none;
        }
      }

      const newHoverInteractie = getHoverInteraction(cmnd.hoverModus).map(selectOption => new ol.interaction.Select(selectOption));

      forEach(model.hoverInteractie, interactie => model.map.removeInteraction(interactie));
      forEach(newHoverInteractie, interactie => model.map.addInteraction(interactie));

      return ModelWithResult({ ...model, hoverInteractie: newHoverInteractie });
    }

    function activeerHighlightModus(cmnd: prt.ActiveerHighlightModusCmd): ModelWithResult<Msg> {
      function getHighlightInteraction(modus: prt.HighlightModus): Option<olx.interaction.SelectOptions> {
        switch (modus) {
          case "on":
            return some({
              condition: ol.events.condition.never,
              features: model.highlightedFeatures,
              style: createSelectionStyleFn(getHoverStyleSelector)
            });
          case "off":
            return none;
        }
      }

      const newHighlightInteractie = getHighlightInteraction(cmnd.highlightModus).map(
        selectOption => new ol.interaction.Select(selectOption)
      );

      forEach(model.highlightInteractie, interactie => model.map.removeInteraction(interactie));
      forEach(newHighlightInteractie, interactie => model.map.addInteraction(interactie));

      return ModelWithResult({ ...model, highlightInteractie: newHighlightInteractie });
    }

    function zetStijlVoorLaagCmd(cmnd: prt.ZetStijlVoorLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerToegevoegdeVectorLaagBestaat(cmnd.titel).map(laag => {
          const updatedLaag = pasVectorLaagStijlAan(some(cmnd.stijl), cmnd.selectieStijl)(laag);
          const updatedModel = pasLaagInModelAan(model)(updatedLaag);
          zendLagenInGroep(updatedModel, updatedLaag.laaggroep);
          zendStijlwijziging(updatedLaag);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function zetStijlSpecVoorLaagCmd(cmnd: prt.ZetStijlSpecVoorLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        chain(valideerToegevoegdeVectorLaagBestaat(cmnd.titel), laag =>
          valideerAlsStijlSpec(cmnd.stijlSpec).map(stijl => {
            const updatedLaag = {
              ...pasVectorLaagStijlAan(ss.asStyleSelector(stijl), laag.selectiestijlSel)(laag),
              stijlSelBron: some(cmnd.stijlSpec),
              legende: some(cmnd.legende)
            };
            const updatedModel = pasLaagInModelAan(model)(updatedLaag);
            zendLagenInGroep(updatedModel, updatedLaag.laaggroep);
            zendStijlwijziging(updatedLaag);
            return ModelAndEmptyResult(updatedModel);
          })
        )
      );
    }

    function toonInfoBoodschap(cmnd: prt.ToonInfoBoodschapCmd): ModelWithResult<Msg> {
      const boodschap = {
        ...cmnd.boodschap,
        laag: fromNullable(model.toegevoegdeLagenOpTitel.get(cmnd.boodschap.titel))
          .filter(laag => laag.bron.type === ke.VectorType)
          .map(laag => laag.bron as ke.VectorLaag)
      };
      updateBehaviorSubject(model.infoBoodschappenSubj, bsch => fptsmap.insert(setoidString)(boodschap.id, boodschap, bsch));
      return ModelWithResult(model);
    }

    function publishKaartLocaties(cmnd: prt.PublishKaartLocatiesCmd): ModelWithResult<Msg> {
      model.publishedKaartLocatiesSubj.next(cmnd.locaties);
      return ModelWithResult(model);
    }

    function deleteInfoBoodschap(cmnd: prt.VerbergInfoBoodschapCmd): ModelWithResult<Msg> {
      updateBehaviorSubject(model.infoBoodschappenSubj, bsch => fptsmap.remove(setoidString)(cmnd.id, bsch));
      return ModelWithResult(model);
    }

    function deleteAlleBoodschappen(): ModelWithResult<Msg> {
      model.infoBoodschappenSubj.next(new Map());
      return ModelWithResult(model);
    }

    function selecteerFeatures(cmnd: prt.SelecteerFeaturesCmd): ModelWithResult<Msg> {
      const currentFeatures = model.geselecteerdeFeatures.features.getArray();

      const newFeatures = cmnd.features;
      const featuresToAdd = array.difference(Feature.setoidFeaturePropertyId)(newFeatures, currentFeatures);

      if (!cmnd.incremental) {
        model.geselecteerdeFeatures.features.clear();
      }
      model.geselecteerdeFeatures.features.extend(featuresToAdd);

      return ModelWithResult(model);
    }

    function deselecteerFeature(cmnd: prt.DeselecteerFeatureCmd): ModelWithResult<Msg> {
      const toDeselect = model.geselecteerdeFeatures.features.getArray().filter(f => cmnd.ids.includes(f.get("id")));
      toDeselect.forEach(f => model.geselecteerdeFeatures.features.remove(f));

      return ModelWithResult(model);
    }

    function deselecteerAlleFeatures(): ModelWithResult<Msg> {
      model.geselecteerdeFeatures.features.clear();
      return ModelWithResult(model);
    }

    function sluitInfoBoodschap(cmnd: prt.SluitInfoBoodschapCmd): ModelWithResult<Msg> {
      const sluitBox = () => updateBehaviorSubject(model.infoBoodschappenSubj, bsch => fptsmap.remove(setoidString)(cmnd.id, bsch));
      const maybeMsg = cmnd.msgGen() as Option<Msg>;
      return maybeMsg.foldL(
        () => {
          // geen message uit functie, sluit de info boodschap zelf
          sluitBox();
          return ModelWithResult(model);
        },
        msg => {
          // stuur sluit message door
          if (cmnd.sluit) {
            sluitBox();
          }
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
        valideerZoekerIsNietGeregistreerd(cmnd.zoekerPrioriteit.zoeker.naam()).map(() => {
          const updatedModel = { ...model, zoekersMetPrioriteiten: array.snoc(model.zoekersMetPrioriteiten, cmnd.zoekerPrioriteit) };
          model.changer.zoekerServicesSubj.next(updatedModel.zoekersMetPrioriteiten);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function verwijderZoeker(cmnd: prt.VerwijderZoekerCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerZoekerIsGeregistreerd(cmnd.zoekerNaam).map(() => {
          const updatedModel = {
            ...model,
            zoekersMetPrioriteiten: array.filter(model.zoekersMetPrioriteiten, zmp => zmp.zoeker.naam() !== cmnd.zoekerNaam)
          };
          model.changer.zoekerServicesSubj.next(updatedModel.zoekersMetPrioriteiten);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function zoek(cmnd: prt.ZoekCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerMinstens1ZoekerGeregistreerd().map(() => {
          modelChanger.zoekopdrachtSubj.next(cmnd.opdracht);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function zoekGeklikt(cmnd: prt.ZoekGekliktCmd): ModelWithResult<Msg> {
      modelChanger.zoekresultaatselectieSubj.next(cmnd.resultaat);
      return ModelWithResult(model);
    }

    function zetMijnLocatieZoom(cmnd: prt.ZetMijnLocatieZoomCmd): ModelWithResult<Msg> {
      modelChanger.mijnLocatieZoomDoelSubj.next(cmnd.doelniveau);
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

    function zetActieveModus(cmnd: prt.ZetActieveModusCmd): ModelWithResult<Msg> {
      modelChanger.actieveModusSubj.next(cmnd.modus);
      return ModelWithResult(model);
    }

    function voegLaagLocatieInformatieServiceToe(cmnd: prt.VoegLaagLocatieInformatieServiceToe): ModelWithResult<Msg> {
      updateBehaviorSubject(modelChanger.laagLocationInfoServicesOpTitelSubj, svcs => svcs.set(cmnd.titel, cmnd.service));
      return ModelWithResult(model);
    }

    function bewerkVectorlaagstijl(cmnd: prt.BewerkVectorlaagstijlCmd): ModelWithResult<Msg> {
      // We zouden kunnen controleren of de laag effectief in het model zit, maar dat is spijkers op laag water zoeken.
      modelChanger.laagstijlaanpassingStateSubj.next(LaagstijlAanpassend(cmnd.laag));
      return ModelWithResult(model);
    }

    function stopVectorlaagstijlBewerking(cmnd: prt.StopVectorlaagstijlBewerkingCmd): ModelWithResult<Msg> {
      modelChanger.laagstijlaanpassingStateSubj.next(GeenLaagstijlaanpassing);
      return ModelWithResult(model);
    }

    function bewerkVectorFilter(cmnd: prt.BewerkVectorFilterCmd): ModelWithResult<Msg> {
      // We zouden kunnen controleren of de laag effectief in het model zit, maar dat is spijkers op laag water zoeken.
      modelChanger.laagfilteraanpassingStateSubj.next(FilterAanpassend(cmnd.laag));
      return ModelWithResult(model);
    }

    function stopVectorFilterBewerking(cmnd: prt.StopVectorFilterBewerkingCmd): ModelWithResult<Msg> {
      modelChanger.laagfilteraanpassingStateSubj.next(GeenFilterAanpassingBezig);
      return ModelWithResult(model);
    }

    function bewerkTransparantie(cmnd: prt.BewerkTransparantieCmd): ModelWithResult<Msg> {
      // We zouden kunnen controleren of de laag effectief in het model zit, maar dat is spijkers op laag water zoeken.
      modelChanger.transparantieAanpassingStateSubj.next(Transparantieaanpassend(cmnd.laag));
      return ModelWithResult(model);
    }

    function stopTransparantieBewerking(cmnd: prt.StopTransparantieBewerkingCmd): ModelWithResult<Msg> {
      modelChanger.transparantieAanpassingStateSubj.next(GeenTransparantieaanpassingBezig);
      return ModelWithResult(model);
    }

    function zetTransparantieVoorLaag(cmnd: prt.ZetTransparantieVoorLaagCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.msgGen,
        valideerToegevoegdeLaagBestaat(cmnd.titel).map(laag => {
          const updatedLaag = { ...laag, transparantie: cmnd.transparantie };
          const updatedModel = pasLaagInModelAan(model)(updatedLaag);
          laag.layer.setOpacity(1 - Transparantie.toNumber(cmnd.transparantie));
          zendLagenInGroep(updatedModel, updatedLaag.laaggroep);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function zetZoomBereik(cmnd: prt.ZetZoomBereikCmd): ModelWithResult<Msg> {
      const view = model.map.getView();
      const minZoom = Math.max(1, Math.min(15, cmnd.minZoom));
      const maxZoom = Math.max(minZoom, Math.min(15, cmnd.maxZoom));
      const zoom = Math.max(minZoom, Math.min(maxZoom, view.getZoom()));
      view.setMinZoom(minZoom);
      view.setMaxZoom(maxZoom);
      view.setZoom(zoom);
      model.changer.zoombereikChangeSubj.next();
      return ModelWithResult(model);
    }

    function ZetDataloadBusy(cmd: prt.ZetDataloadBusyCmd): ModelWithResult<Msg> {
      modelChanger.dataloadBusySubj.next(cmd.busy);
      return ModelWithResult(model);
    }

    function ZetForceProgressBar(cmd: prt.ZetForceProgressBarCmd): ModelWithResult<Msg> {
      modelChanger.forceProgressBarSubj.next(cmd.busy);
      return ModelWithResult(model);
    }

    function registreerError(cmd: prt.RegistreerErrorCmd): ModelWithResult<Msg> {
      modelChanger.inErrorSubj.next(cmd.inError);
      return ModelWithResult(model);
    }

    function sluitPanelen(cmnd: prt.SluitPanelenCmd): ModelWithResult<Msg> {
      updateBehaviorSubject(model.infoBoodschappenSubj, () => new Map());
      modelChanger.laagstijlaanpassingStateSubj.next(GeenLaagstijlaanpassing);
      return ModelWithResult(model);
    }

    function activeerCacheVoorLaag(cmnd: prt.ActiveerCacheVoorLaag<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerToegevoegdeLaagBestaat(cmnd.titel).map(laag => {
          ke.asTiledWmsLaag(laag.bron).map(tiledWms =>
            tiledWms.urls.map(url => serviceworker.registreerRoute(cmnd.titel, `${url}.*${tiledWms.naam}.*`))
          );
          return ModelAndEmptyResult(model);
        })
      );
    }

    function vulCacheVoorWMSLaag(cmnd: prt.VulCacheVoorWMSLaag<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerTiledWmsBestaat(cmnd.titel).map(tiledWms => {
          refreshTiles(
            cmnd.titel,
            tiledWms.getSource() as ol.source.UrlTile,
            cmnd.startZoom,
            cmnd.eindZoom,
            cmnd.wkt,
            cmnd.startMetLegeCache
          )
            // We willen niet meer dan 1/sec progress sturen, maar de laatste willen we zeker
            .pipe(throttleTime(1000, undefined, { leading: true, trailing: true }))
            .subscribe(progress => {
              if (progress.percentage === 100) {
                metaDataDb.write(cmnd.titel, progress.started).subscribe(() =>
                  updateBehaviorSubject(modelChanger.laatsteCacheRefreshSubj, laatsteCacheRefresh => {
                    return { ...laatsteCacheRefresh, [cmnd.titel]: progress.started };
                  })
                );
              }
              updateBehaviorSubject(modelChanger.precacheProgressSubj, precacheLaagProgress => {
                return { ...precacheLaagProgress, [cmnd.titel]: progress.percentage };
              });
            });
          return ModelAndEmptyResult(model);
        })
      );
    }

    function vulCacheVoorNosqlLaag(cmnd: prt.VulCacheVoorNosqlLaag<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerNoSqlFsSourceBestaat(cmnd.titel).map(noSqlSource => {
          (cmnd.startMetLegeCache ? featureStore.clear(cmnd.titel) : rx.of(undefined))
            .pipe(
              switchMap(() =>
                noSqlSource.fetchFeaturesByWkt$(cmnd.wkt).pipe(
                  bufferCount(1000),
                  switchMap(features => featureStore.writeFeatures(cmnd.titel, features))
                )
              )
            )
            .subscribe(aantal => kaartLogger.debug(`${aantal} features in cache bewaard`), error => kaartLogger.error(error));
          return ModelAndEmptyResult(model);
        })
      );
    }

    function activeerFilterOpSource(noSqlFsSource: NosqlFsSource, filter: fltr.Filter, actief: boolean): void {
      noSqlFsSource.setUserFilter(filter, actief);
    }

    function zetFilter(cmnd: prt.ZetFilter<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        chain(valideerToegevoegdeVectorLaagBestaat(cmnd.titel), laag =>
          valideerNoSqlFsSourceBestaat(cmnd.titel).map(noSqlFsSource => [laag, noSqlFsSource])
        ).map(([laag, noSqlFsSource]: [ke.ToegevoegdeVectorLaag, NosqlFsSource]) => {
          activeerFilterOpSource(noSqlFsSource, cmnd.filter, true);
          const updatedLaag = pasLaagFilterAan(cmnd.filter, true, laag.filterinstellingen.totaal)(laag);
          const updatedModel = pasLaagInModelAan(model)(updatedLaag);
          zendLagenInGroep(updatedModel, updatedLaag.laaggroep);
          zendFilterwijziging(updatedLaag);
          berekenFilterTotalen(updatedLaag);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function activeerFilter(cmnd: prt.ActiveerFilter<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        chain(valideerToegevoegdeVectorLaagBestaat(cmnd.titel), laag =>
          valideerNoSqlFsSourceBestaat(cmnd.titel).map(noSqlFsSource => [laag, noSqlFsSource])
        ).map(([laag, noSqlFsSource]: [ke.ToegevoegdeVectorLaag, NosqlFsSource]) => {
          activeerFilterOpSource(noSqlFsSource, laag.filterinstellingen.spec, cmnd.actief);
          const updatedLaag = pasLaagFilterAan(laag.filterinstellingen.spec, cmnd.actief, laag.filterinstellingen.totaal)(laag);
          const updatedModel = pasLaagInModelAan(model)(updatedLaag);
          zendLagenInGroep(updatedModel, updatedLaag.laaggroep);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function berekenFilterTotalen(laag: ke.ToegevoegdeVectorLaag): void {
      forEach(ke.asNosqlSource(laag.layer.getSource()), nosqlFsSource =>
        nosqlFsSource.fetchTotal$().subscribe({
          next: totaal => {
            const updatedLaag = pasLaagFilterAan(laag.filterinstellingen.spec, laag.filterinstellingen.actief, totaal)(laag);
            const updatedModel = pasLaagInModelAan(model)(updatedLaag);
            zendLagenInGroep(updatedModel, updatedLaag.laaggroep);
          }
        })
      );
    }

    function haalFilterTotaalOp(cmnd: prt.HaalFilterTotaalOp<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerToegevoegdeVectorLaagBestaat(cmnd.titel).map(laag => {
          berekenFilterTotalen(laag);

          const updatedLaag = pasLaagFilterAan(laag.filterinstellingen.spec, laag.filterinstellingen.actief, totaalOpTeHalen())(laag);
          const updatedModel = pasLaagInModelAan(model)(updatedLaag);
          zendLagenInGroep(updatedModel, updatedLaag.laaggroep);
          zendFilterwijziging(updatedLaag);
          return ModelAndEmptyResult(updatedModel);
        })
      );
    }

    function zetOffline(cmnd: prt.ZetOffline<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmnd.wrapper,
        valideerNoSqlFsSourceBestaat(cmnd.titel).map(noSqlFsSource => {
          noSqlFsSource.setOffline(cmnd.offline);
          return ModelAndEmptyResult(model);
        })
      );
    }

    function vraagCachedFeaturesLookup(cmd: prt.VraagCachedFeaturesLookupCmd<Msg>): ModelWithResult<Msg> {
      return toModelWithValueResult(
        cmd.msgGen,
        valideerNoSqlFsSourceBestaat(cmd.titel).map(noSqlFsSource =>
          ModelAndValue(model, CachedFeatureLookup.fromObjectStore(noSqlFsSource.cacheStoreName(), cmd.titel))
        )
      );
    }

    function drawOpsCmd(cmnd: prt.DrawOpsCmd): ModelWithResult<Msg> {
      modelChanger.tekenenOpsSubj.next(cmnd.ops);
      return ModelWithResult(model);
    }

    function emitMijnLocatieStateChange(cmnd: prt.MijnLocatieStateChangeCmd): ModelWithResult<Msg> {
      modelChanger.mijnLocatieStateChangeSubj.next({ oudeState: cmnd.oudeState, nieuweState: cmnd.nieuweState, event: cmnd.event });
      return ModelWithResult(model);
    }

    function emitTabelStateChange(state: TabelStateChange): ModelWithResult<Msg> {
      modelChanger.tabelStateSubj.next(state);
      return ModelWithResult(model);
    }

    function openTabel(): ModelWithResult<Msg> {
      modelChanger.tabelStateSubj.next(TabelStateChange("Opengeklapt", true));
      // Bij openen van het tabel paneel met deze 2 knoppen:
      // Verdwijnen alle openstaande pop-up cards (bv kaart bevragen, meten,...)
      modelChanger.laagstijlaanpassingStateSubj.next(GeenLaagstijlaanpassing);
      modelChanger.transparantieAanpassingStateSubj.next(GeenTransparantieaanpassingBezig);
      return deleteAlleBoodschappen();
    }

    function zetGetekendeGeometry(cmnd: prt.ZetGetekendeGeometryCmd): ModelWithResult<Msg> {
      modelChanger.getekendeGeometrySubj.next(cmnd.geometry);
      return ModelWithResult(model);
    }

    function handleSubscriptions(cmnd: prt.SubscribeCmd<Msg>): ModelWithResult<Msg> {
      function modelWithSubscriptionResult(name: string, subscription: Subscription): ModelWithResult<Msg> {
        return toModelWithValueResult(cmnd.wrapper, success(ModelAndValue(model, { subscription: subscription, subscriberName: name })));
      }

      function subscribeToViewinstellingen(sub: prt.ViewinstellingenSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "Viewinstellingen",
          modelChanges.viewinstellingen$.pipe(debounceTime(100)).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToGeselecteerdeFeatures(sub: prt.GeselecteerdeFeaturesSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("GeselecteerdeFeatures", modelChanges.geselecteerdeFeatures$.subscribe(consumeMessage(sub)));
      }

      function subscribeToHoverFeatures(sub: prt.HoverFeaturesSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "HoverFeatures",
          modelChanges.hoverFeatures$.subscribe(pm => {
            msgConsumer(sub.wrapper(pm));
          })
        );
      }

      function subscribeToZichtbareFeatures(sub: prt.ZichtbareFeaturesSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "ZichtbareFeatures", //
          modelChanges.zichtbareFeatures$.subscribe(consumeMessage(sub))
        );
      }

      function subscribeToZoom(sub: prt.ZoomSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "Zoom",
          modelChanges.viewinstellingen$
            .pipe(
              debounceTime(100),
              map(i => i.zoom),
              distinctUntilChanged()
            )
            .subscribe(consumeMessage(sub))
        );
      }

      function subscribeToMiddelpunt(sub: prt.MiddelpuntSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "Middelpunt",
          modelChanges.viewinstellingen$
            .pipe(
              debounceTime(100),
              map(i => i.center),
              distinctUntilChanged()
            )
            .subscribe(consumeMessage(sub))
        );
      }

      function subscribeToExtent(sub: prt.ExtentSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "Extent",
          modelChanges.viewinstellingen$
            .pipe(
              debounceTime(100),
              map(i => i.extent),
              distinctUntilChanged()
            )
            .subscribe(consumeMessage(sub))
        );
      }

      function subscribeToAchtergrondTitel(sub: prt.AchtergrondTitelSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("AchtergrondTitel", model.achtergrondlaagtitelSubj.subscribe(consumeMessage(sub)));
      }

      function subscribeToKaartClick(sub: prt.KaartClickSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "KaartClick",
          modelChanges.kaartKlikLocatie$.pipe(map(l => l.coordinate)).subscribe(consumeMessage(sub))
        );
      }

      const subscribeToLagenInGroep = (sub: prt.LagenInGroepSubscription<Msg>) => {
        return modelWithSubscriptionResult(
          "LagenInGroep",
          modelChanger.lagenOpGroepSubj[sub.groep].pipe(debounceTime(50)).subscribe(consumeMessage(sub))
        );
      };

      const subscribeToLaagVerwijderd = (sub: prt.LaagVerwijderdSubscription<Msg>) =>
        modelWithSubscriptionResult("LaagVerwijderd", modelChanger.laagVerwijderdSubj.subscribe(consumeMessage(sub)));

      function subscribeToZoekResultaten(sub: prt.ZoekResultatenSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("ZoekAntwoord", modelChanges.zoekresultaten$.subscribe(consumeMessage(sub)));
      }

      function subscribeToZoekResultaatSelectie(sub: prt.ZoekResultaatSelectieSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("ZoekResultaatSelectie", modelChanges.zoekresultaatselectie$.subscribe(consumeMessage(sub)));
      }

      function subscribeToZoekers(sub: prt.ZoekersSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("Zoekers", modelChanges.zoekerServices$.subscribe(consumeMessage(sub)));
      }

      function subscribeToGeometryChanged(sub: prt.GeometryChangedSubscription<Msg>): ModelWithResult<Msg> {
        // Deze is een klein beetje speciaal omdat we de unsubcribe willen opvangen om evt. het tekenen te stoppen
        return modelWithSubscriptionResult(
          "TekenGeometryChanged",
          rx.Observable.create((observer: rx.Observer<ke.Tekenresultaat>) => {
            model.tekenSettingsSubj.next(some(sub.tekenSettings));
            const innerSub = model.geometryChangedSubj.pipe(debounceTime(100)).subscribe(observer);
            return () => {
              innerSub.unsubscribe();
              if (model.geometryChangedSubj.observers.length === 0) {
                model.tekenSettingsSubj.next(none);
              }
            };
          }).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToTekenen(sub: prt.TekenenSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("Tekenen", model.tekenSettingsSubj.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub)));
      }

      function subscribeToPublishedKaartLocaties(sub: prt.PublishedKaartLocatiesSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "PublishedKaartLocaties",
          model.publishedKaartLocatiesSubj.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToActieveModus(sub: prt.ActieveModusSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("ActieveModus", modelChanges.actieveModus$.subscribe(consumeMessage(sub)));
      }

      function subscribeToInfoBoodschappen(sub: prt.InfoBoodschappenSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("InfoBoodschappen", model.infoBoodschappenSubj.subscribe(consumeMessage(sub)));
      }

      function subscribeToComponentFouten(sub: prt.ComponentFoutSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("Componentfouten", model.componentFoutSubj.subscribe(consumeMessage(sub)));
      }

      function subscribeToLaagstijlGezet(sub: prt.LaagstijlGezetSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("LaagstijlGezet", modelChanges.laagstijlGezet$.subscribe(consumeMessage(sub)));
      }

      function subscribeToLaagfilterGezet(sub: prt.LaagfilterGezetSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("LaagfilterGezet", modelChanges.laagfilterGezet$.subscribe(consumeMessage(sub)));
      }

      function subscribeToPrecacheProgress(sub: prt.PrecacheProgressSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "PrecacheProgress",
          modelChanges.precacheProgress$.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToLaatsteCacheRefresh(sub: prt.LaatsteCacheRefreshSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "LaatsteCacheRefresh",
          modelChanges.laatsteCacheRefresh$.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToMijnLocatieStateChange(sub: prt.MijnLocatieStateChangeSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "MijnLocatieStateChange",
          modelChanges.mijnLocatieStateChange$.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToBusy(sub: prt.BusySubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("Busy", modelChanges.dataloadBusy$.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub)));
      }

      function subscribeToForceProgressBar(sub: prt.ForceProgressBarSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "ForceProgressBar",
          modelChanges.forceProgressBar$.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToTableState(sub: prt.TabelStateSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult(
          "TableState",
          modelChanges.tabelState$.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub))
        );
      }

      function subscribeToInError(sub: prt.InErrorSubscription<Msg>): ModelWithResult<Msg> {
        return modelWithSubscriptionResult("InError", modelChanges.inError$.pipe(distinctUntilChanged()).subscribe(consumeMessage(sub)));
      }

      switch (cmnd.subscription.type) {
        case "Viewinstellingen":
          return subscribeToViewinstellingen(cmnd.subscription);
        case "Zoom":
          return subscribeToZoom(cmnd.subscription);
        case "Middelpunt":
          return subscribeToMiddelpunt(cmnd.subscription);
        case "Extent":
          return subscribeToExtent(cmnd.subscription);
        case "Achtergrond":
          return subscribeToAchtergrondTitel(cmnd.subscription);
        case "GeselecteerdeFeatures":
          return subscribeToGeselecteerdeFeatures(cmnd.subscription);
        case "HoverFeatures":
          return subscribeToHoverFeatures(cmnd.subscription);
        case "ZichtbareFeatures":
          return subscribeToZichtbareFeatures(cmnd.subscription);
        case "LagenInGroep":
          return subscribeToLagenInGroep(cmnd.subscription);
        case "LaagVerwijderd":
          return subscribeToLaagVerwijderd(cmnd.subscription);
        case "KaartClick":
          return subscribeToKaartClick(cmnd.subscription);
        case "ZoekAntwoord":
          return subscribeToZoekResultaten(cmnd.subscription);
        case "ZoekResultaatSelectie":
          return subscribeToZoekResultaatSelectie(cmnd.subscription);
        case "Zoekers":
          return subscribeToZoekers(cmnd.subscription);
        case "GeometryChanged":
          return subscribeToGeometryChanged(cmnd.subscription);
        case "Tekenen":
          return subscribeToTekenen(cmnd.subscription);
        case "PublishedKaartLocaties":
          return subscribeToPublishedKaartLocaties(cmnd.subscription);
        case "InfoBoodschap":
          return subscribeToInfoBoodschappen(cmnd.subscription);
        case "ComponentFout":
          return subscribeToComponentFouten(cmnd.subscription);
        case "ActieveModus":
          return subscribeToActieveModus(cmnd.subscription);
        case "LaagstijlGezet":
          return subscribeToLaagstijlGezet(cmnd.subscription);
        case "LaagfilterGezet":
          return subscribeToLaagfilterGezet(cmnd.subscription);
        case "PrecacheProgress":
          return subscribeToPrecacheProgress(cmnd.subscription);
        case "LaatsteCacheRefresh":
          return subscribeToLaatsteCacheRefresh(cmnd.subscription);
        case "MijnLocatieStateChange":
          return subscribeToMijnLocatieStateChange(cmnd.subscription);
        case "TabelState":
          return subscribeToTableState(cmnd.subscription);
        case "Busy":
          return subscribeToBusy(cmnd.subscription);
        case "ForceProgressBar":
          return subscribeToForceProgressBar(cmnd.subscription);
        case "InError":
          return subscribeToInError(cmnd.subscription);
      }
    }

    function handleUnsubscriptions(cmnd: prt.UnsubscribeCmd): ModelWithResult<Msg> {
      cmnd.subscriptionResult.subscription.unsubscribe();
      return ModelWithResult(model);
    }

    function unsafeHandleCommand(): ModelWithResult<Msg> {
      switch (cmd.type) {
        case "VoegLaagToe":
          return voegLaagToeCmd(cmd);
        case "VerwijderLaag":
          return verwijderLaagCmd(cmd);
        case "VerplaatsLaag":
          return verplaatsLaagCmd(cmd);
        case "VervangLaagCmd":
          return vervangLaag(cmd);
        case "ZetLaagLegende":
          return zetLaagLegende(cmd);
        case "VraagSchaalAan":
          return vraagSchaalAan(cmd);
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
        case "VeranderRotatie":
          return veranderRotatieCmd(cmd);
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
        case "ActiveerHighlightModus":
          return activeerHighlightModus(cmd);
        case "ActiveerHoverModus":
          return activeerHoverModus(cmd);
        case "ActiveerSelectieModus":
          return activeerSelectieModus(cmd);
        case "DeactiveerSelectieModus":
          return deactiveerSelectieModus(cmd);
        case "ReactiveerSelectieModus":
          return reactiveerSelectieModus(cmd);
        case "ToonAchtergrondKeuze":
          return toonAchtergrondkeuzeCmd(cmd);
        case "VerbergAchtergrondKeuze":
          return verbergAchtergrondkeuzeCmd(cmd);
        case "AbortTileLoading":
          return abortTileLoadingCmd(cmd);
        case "KiesAchtergrond":
          return kiesAchtergrondCmd(cmd);
        case "MaakLaagZichtbaar":
          return maakLaagZichtbaarCmd(cmd);
        case "MaakLaagOnzichtbaar":
          return maakLaagOnzichtbaarCmd(cmd);
        case "ZetLaagSelecteerbaar":
          return zetLaagSelecteerbaarCmd(cmd);
        case "ZetStijlVoorLaag":
          return zetStijlVoorLaagCmd(cmd);
        case "ZetStijlSpecVoorLaag":
          return zetStijlSpecVoorLaagCmd(cmd);
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
        case "ZoekGeklikt":
          return zoekGeklikt(cmd);
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
        case "SelecteerFeatures":
          return selecteerFeatures(cmd);
        case "DeselecteerFeature":
          return deselecteerFeature(cmd);
        case "DeselecteerAlleFeatures":
          return deselecteerAlleFeatures();
        case "SluitInfoBoodschap":
          return sluitInfoBoodschap(cmd);
        case "VoegUiElementToe":
          return voegUiElementToe(cmd);
        case "VerwijderUiElement":
          return verwijderUiElement(cmd);
        case "ZetUiElementOpties":
          return zetUiElementOpties(cmd);
        case "ZetActieveModus":
          return zetActieveModus(cmd);
        case "PublishKaartLocaties":
          return publishKaartLocaties(cmd);
        case "VoegLaagLocatieInformatieServiceToe":
          return voegLaagLocatieInformatieServiceToe(cmd);
        case "BewerkVectorlaagstijl":
          return bewerkVectorlaagstijl(cmd);
        case "StopVectorlaagstijlBewerking":
          return stopVectorlaagstijlBewerking(cmd);
        case "SluitPanelen":
          return sluitPanelen(cmd);
        case "ActiveerCacheVoorLaag":
          return activeerCacheVoorLaag(cmd);
        case "VulCacheVoorWMSLaag":
          return vulCacheVoorWMSLaag(cmd);
        case "VulCacheVoorNosqlLaag":
          return vulCacheVoorNosqlLaag(cmd);
        case "HighlightFeatures":
          return highlightFeaturesCmd(cmd);
        case "DrawOps":
          return drawOpsCmd(cmd);
        case "VraagCachedFeaturesLookup":
          return vraagCachedFeaturesLookup(cmd);
        case "ZetGetekendeGeometry":
          return zetGetekendeGeometry(cmd);
        case "ZetOffline":
          return zetOffline(cmd);
        case "BewerkVectorFilter":
          return bewerkVectorFilter(cmd);
        case "StopVectorFilterBewerking":
          return stopVectorFilterBewerking(cmd);
        case "ZetFilter":
          return zetFilter(cmd);
        case "ActiveerFilter":
          return activeerFilter(cmd);
        case "HaalFilterTotaalOp":
          return haalFilterTotaalOp(cmd);
        case "MijnLocatieStateChange":
          return emitMijnLocatieStateChange(cmd);
        case "BewerkTransparantie":
          return bewerkTransparantie(cmd);
        case "StopTransparantieBewerking":
          return stopTransparantieBewerking(cmd);
        case "ZetTransparantieVoorLaag":
          return zetTransparantieVoorLaag(cmd);
        case "ZetZoomBereik":
          return zetZoomBereik(cmd);
        case "TabelStateChange":
          return emitTabelStateChange(cmd.state);
        case "OpenTabel":
          return openTabel();
        case "SluitTabel":
          return emitTabelStateChange(TabelStateChange("Dichtgeklapt", true));
        case "RegistreerError":
          return registreerError(cmd);
        case "ZetDataloadBusy":
          return ZetDataloadBusy(cmd);
        case "ZetForceProgressBar":
          return ZetForceProgressBar(cmd);
      }
    }

    try {
      // Wij doen ons best om veilig te zijn adhv Validation, Option e.d., maar we gebruiken ook openlayers en dat heeft
      // de neiging om af en toe hard te crashen. Vandaar de nood om onze kernfunctionaliteit nog in een try-catch te
      // steken.
      return unsafeHandleCommand();
    } catch (e) {
      kaartLogger.error("Er is een fout opgetreden bij het verwerken van commando", cmd, e);
      return ModelWithResult(model);
    }
  };
}
