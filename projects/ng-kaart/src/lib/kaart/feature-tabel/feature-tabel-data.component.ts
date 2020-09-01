import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  NgZone,
  ViewEncapsulation,
} from "@angular/core";
import { array, option } from "fp-ts";
import { flow, Function1, Refinement } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  share,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
  withLatestFrom,
} from "rxjs/operators";

import * as arrays from "../../util/arrays";
import { isBoolean } from "../../util/boolean";
import { Feature } from "../../util/feature";
import { PartialFunction1, PartialFunction2 } from "../../util/function";
import * as ol from "../../util/openlayers-compat";
import { collect } from "../../util/operators";
import { isString, join } from "../../util/string";
import { KaartChildDirective } from "../kaart-child.directive";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import {
  Laagtabelinstellingen,
  Veldsortering,
} from "../kaart-protocol-subscriptions";
import { KaartComponent } from "../kaart.component";

import { Alignment } from "./alignment-model";
import { Page } from "./data-provider";
import { FeatureTabelOpties, KnopConfiguratie } from "./feature-tabel-opties";
import {
  FeatureTabelOverzichtComponent,
  FeatureTabelUiSelector,
} from "./feature-tabel-overzicht.component";
import { FieldSelection } from "./field-selection-model";
import { LaagModel } from "./laag-model";
import { Row } from "./row-model";
import { TableModel } from "./table-model";

// Volgende interfaces zijn bedoeld voor gebruik in de template.
interface ColumnHeaders {
  readonly headers: FieldSelection[];
  readonly columnWidths: string; // we willen dit niet in de template opbouwen
}

namespace ColumnHeaders {
  const create: Function1<FieldSelection[], ColumnHeaders> = (
    fieldSelections
  ) => ({
    headers: fieldSelections,
    columnWidths: pipe(
      fieldSelections,
      array.map((fs) => fs.contributingVeldinfos.length),
      array.map(
        (numFields) => `minmax(${140 + (numFields - 1) * 35}px, 400px)`
      ),
      join(" ")
    ),
  });

  export const createFromFieldSelection: Function1<
    FieldSelection[],
    ColumnHeaders
  > = flow(array.filter(FieldSelection.selectedLens.get), create);
}

const neededZoom: PartialFunction2<ol.Map, ol.Extent, number> = (map, extent) =>
  option.fromNullable(
    map
      .getView()
      .getZoomForResolution(
        map.getView().getResolutionForExtent(extent, map.getSize())
      )
  );

const isFieldSelection: Refinement<any, FieldSelection> = (
  fieldSelection
): fieldSelection is FieldSelection =>
  fieldSelection.hasOwnProperty("selected") &&
  fieldSelection.hasOwnProperty("name");

interface TemplateData {
  readonly dataAvailable: boolean;
  readonly featureDataAvailable: boolean;
  readonly fieldNameSelections: FieldSelection[];
  readonly headers: ColumnHeaders;
  readonly rows?: Row[];
  readonly mapAsFilterState: boolean;
  readonly showOnlySelectedFeatures: boolean;
  readonly cannotChooseMapAsFilter: boolean;
  readonly updatePending: boolean;
  readonly numGeselecteerdeFeatures: number;
  readonly hasSelectedFeatures: boolean;
  readonly allRowsSelected: boolean;
  readonly allFieldsSelected: boolean;
  readonly comfortableLayout: boolean;
  readonly alignments: Record<string, Alignment>;
  readonly extraKnoppen: KnopConfiguratie[];
}

interface RowSelection {
  readonly row: Row;
  readonly selected: boolean;
}

@Component({
  selector: "awv-feature-tabel-data",
  templateUrl: "./feature-tabel-data.component.html",
  styleUrls: ["./feature-tabel-data.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureTabelDataComponent extends KaartChildDirective {
  // Voor de template
  public readonly templateData$: rx.Observable<TemplateData>;
  public readonly rows$: rx.Observable<Row[]>;
  // Voor child components
  public readonly laag$: rx.Observable<LaagModel>;

  @Input()
  laagTitel: string;

  constructor(
    kaart: KaartComponent,
    overzicht: FeatureTabelOverzichtComponent,
    ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    super(kaart, ngZone);

    this.dispatch(
      prt.InitUiElementOpties(FeatureTabelUiSelector, {
        dataHeaderMenuExtraKnoppen: [],
      })
    );
    const options$ = this.accumulatedOpties$<FeatureTabelOpties>(
      FeatureTabelUiSelector
    );

    this.laag$ = this.viewReady$
      .pipe(
        // De input is pas beschikbaar nadat de view klaar is
        switchMap(() => overzicht.laagModel$(this.laagTitel)),
        share()
      )
      .pipe(shareReplay(1)); // De pager zit in een *ngIf, dus subscribe na emit

    const layoutMode$ = overzicht.tableModel$.pipe(
      map(TableModel.layoutInstellingGetter.get),
      distinctUntilChanged()
    );

    // Dit zorgt enkel voor het al dan niet kunnen schakelen tussen kaart als filter en alle data en wordt enkel 1 maal
    // in het begin uitgevoerd. We kunnen dit niet krijgen door op een initiële filterupdate te luisteren, want die
    // komt enkel als er effectief een filter gezet is.
    const totalFeaturesUpdate$: rx.Observable<LaagModel.LaagModelUpdate> = rx.of(
      LaagModel.getTotalFeaturesUpdate
    );

    const numGeselecteerdeFeatures$ = this.inViewReady(() =>
      this.modelChanges.geselecteerdeFeatures$.pipe(
        map(prt.FeatureSelection.selectedFeaturesInLaagSize(this.laagTitel)),
        startWith(0)
      )
    );

    const extraKnoppen$ = options$.pipe(
      map((options) => options.dataHeaderMenuExtraKnoppen)
    );

    // Alle data voor de template wordt in 1 custom datastructuur gegoten. Dat heeft als voordeel dat er geen gezever is
    // met observables die binnen *ngIf staan. Het nadeel is frequentere updates omdat er geen distinctUntil is. Die zou
    // immers de rows array moeten meenemen.
    this.templateData$ = rx
      .combineLatest([
        layoutMode$,
        this.laag$,
        numGeselecteerdeFeatures$,
        extraKnoppen$,
      ])
      .pipe(
        map(
          ([layoutMode, laagModel, numGeselecteerdeFeatures, extraKnoppen]) => {
            const fieldNameSelections = LaagModel.fieldSelectionsGetter.get(
              laagModel
            );
            const showOnlySelectedFeatures =
              LaagModel.selectionViewModeGetter.get(laagModel) ===
              "SelectedOnly";
            const maybeRows = LaagModel.pageGetter
              .get(laagModel)
              .map(Page.rowsLens.get);
            const rows = option.toUndefined(maybeRows); // -> handiger in template
            const allRowsSelected =
              showOnlySelectedFeatures ||
              pipe(
                maybeRows,
                option.exists(arrays.forAll((row) => !!row.selected))
              );
            const allFieldsSelected = arrays.forAll(
              FieldSelection.selectedLens.get
            )(laagModel.fieldSelections);

            return {
              dataAvailable: rows !== undefined,
              featureDataAvailable: option.exists(arrays.isNonEmpty)(maybeRows),
              fieldNameSelections,
              headers: ColumnHeaders.createFromFieldSelection(
                fieldNameSelections
              ),
              rows,
              mapAsFilterState:
                LaagModel.viewSourceModeGetter.get(laagModel) === "Map",
              cannotChooseMapAsFilter: !LaagModel.canUseAllFeaturesGetter.get(
                laagModel
              ),
              updatePending: LaagModel.updatePendingGetter.get(laagModel),
              numGeselecteerdeFeatures,
              hasSelectedFeatures: numGeselecteerdeFeatures > 0,
              showOnlySelectedFeatures,
              allRowsSelected,
              allFieldsSelected,
              comfortableLayout: layoutMode === "Comfortable",
              alignments: Alignment.createFromFieldSelection(
                fieldNameSelections
              ),
              extraKnoppen,
            };
          }
        ),
        share()
      );

    this.rows$ = this.laag$.pipe(
      map((laag) =>
        LaagModel.pageGetter.get(laag).map(Page.rowsLens.get).getOrElse([])
      )
    );

    const fieldSelectionsUpdate$ = rx.merge(
      this.actionFor$("chooseBaseFields").pipe(
        mapTo(LaagModel.chooseBaseFieldsUpdate)
      ),
      this.actionFor$("chooseAllFields").pipe(
        mapTo(LaagModel.chooseAllFieldsUpdate)
      ),
      this.actionFor$("chooseNoFields").pipe(
        mapTo(LaagModel.chooseNoFieldsUpdate)
      ),
      this.actionDataFor$("toggleField", isFieldSelection).pipe(
        map((fieldSelection) =>
          LaagModel.setFieldSelectedUpdate(
            fieldSelection.name,
            !fieldSelection.selected
          )
        )
      ),
      this.actionFor$("showOnlySelectedFeatures").pipe(
        mapTo(LaagModel.setShowSelectedOnlyUpdate(true))
      ),
      this.actionFor$("showAllFeatures").pipe(
        mapTo(LaagModel.setShowSelectedOnlyUpdate(false))
      )
    );

    const sortUpdate$ = this.actionDataFor$("toggleSort", isString).pipe(
      map(LaagModel.sortFieldToggleUpdate)
    );

    const viewModeUpdate$ = this.actionDataFor$("mapAsFilter", isBoolean).pipe(
      map(LaagModel.setMapAsFilterUpdate)
    );

    const doUpdate$ = (titel: string) =>
      rx
        .merge(
          fieldSelectionsUpdate$,
          sortUpdate$,
          viewModeUpdate$,
          totalFeaturesUpdate$
        )
        .pipe(tap(overzicht.laagUpdater(titel)));

    this.runInViewReady(rx.defer(() => doUpdate$(this.laagTitel)));

    const selectAll$ = this.actionDataFor$("selectAll", isBoolean);
    const selectRow$ = this.rawActionDataFor$("selectRow") as rx.Observable<
      RowSelection
    >;
    const eraseSelection$ = this.actionFor$("eraseSelection");
    const zoomToSelection$ = this.actionFor$("zoomToSelection");
    const zoomToRow$ = this.rawActionDataFor$("zoomToRow") as rx.Observable<
      Row
    >;

    // hou in de row bij of die geselecteerd is of niet
    // kan dus veranderen als de rijen veranderen, of de selection verandert
    this.runInViewReady(
      rx
        .combineLatest([this.rows$, this.modelChanges.geselecteerdeFeatures$])
        .pipe(
          tap(([rows, selection]: [Row[], prt.GeselecteerdeFeatures]) => {
            rows.forEach((r) => {
              r.selected = prt.FeatureSelection.isSelected(selection)(
                r.feature
              );
            });
            this.cdr.detectChanges();
          })
        )
    );

    // zoom naar de selectie
    const zoomToSelectionExtent$ = zoomToSelection$.pipe(
      withLatestFrom(this.modelChanges.geselecteerdeFeatures$),
      map(([_, selection]) =>
        pipe(
          selection,
          prt.FeatureSelection.getGeselecteerdeFeaturesInLaag(this.laagTitel),
          array.filterMap((feature) =>
            option.fromNullable(feature.getGeometry())
          ),
          array.map((geom) => geom.getExtent()),
          Feature.combineExtents,
          option.getOrElse(() => [0, 0, 0, 0] as ol.Extent) // Er is de praktijk altijd een geselecteerde feature
        )
      ),
      share()
    );

    const zoomToSelectionCmd$ = zoomToSelectionExtent$.pipe(
      map(prt.VeranderExtentCmd)
    );

    const olMap$ = this.kaartModel$.pipe(
      map((m) => m.map),
      take(1)
    );
    const numGeselecteerdeFeaturesInLaag$ = zoomToSelection$.pipe(
      withLatestFrom(this.modelChanges.geselecteerdeFeatures$),
      map(([_, selection]) =>
        pipe(
          selection,
          prt.FeatureSelection.getGeselecteerdeFeaturesInLaag(this.laagTitel),
          arrays.length
        )
      )
    );

    const warnZoomToSelectionCmd$ = zoomToSelectionExtent$.pipe(
      withLatestFrom(olMap$, this.laag$, numGeselecteerdeFeaturesInLaag$),
      filter(([extent, map, laagModel, _]) =>
        option.fold(
          () => true,
          (zoom: number) => zoom < laagModel.minZoom
        )(neededZoom(map, extent))
      ),
      map(([_1, _2, _3, numGeselecteerdeFeaturesInLaag]) =>
        prt.ToonMeldingCmd([
          `${this.laagTitel} zijn niet zichtbaar op huidig zoom niveau`,
        ])
      )
    );

    // wis volledige selectie voor deze laag
    const clearSelectionCmd$ = eraseSelection$.pipe(
      withLatestFrom(this.modelChanges.geselecteerdeFeatures$),
      map(([_, geselecteerdeFeatures]) =>
        pipe(
          geselecteerdeFeatures,
          prt.FeatureSelection.getGeselecteerdeFeaturesInLaag(this.laagTitel),
          prt.DeselecteerFeatureCmd
        )
      )
    );

    // (de)selecteer een enkele rij
    const toggleRowSelctionCmd$ = selectRow$.pipe(
      map((rowSelection) =>
        rowSelection.selected
          ? prt.SelecteerExtraFeaturesCmd([rowSelection.row.feature.feature])
          : prt.DeselecteerFeatureCmd([rowSelection.row.feature.feature])
      )
    );

    // (de)selecteer alle rijen
    const toggleAllRowsSelectionCmd$ = selectAll$.pipe(
      withLatestFrom(this.rows$),
      map(([select, rows]: [boolean, Row[]]) =>
        select
          ? pipe(
              rows,
              array.map(Row.olFeatureLens.get),
              prt.SelecteerExtraFeaturesCmd
            )
          : pipe(
              rows,
              array.map(Row.olFeatureLens.get),
              prt.DeselecteerFeatureCmd
            )
      )
    );

    // zoom naar individuele rij
    const zoomToIndividualRowExtent$ = zoomToRow$.pipe(
      collect((row) => row.feature.feature.getGeometry()),
      map((geom) => geom.getExtent()),
      share()
    );

    const zoomToIndividualRowCmd$ = zoomToIndividualRowExtent$.pipe(
      map(prt.VeranderExtentCmd)
    );

    const warnZoomToIndividualRowCmd$ = zoomToIndividualRowExtent$.pipe(
      withLatestFrom(olMap$, this.laag$),
      filter(([extent, map, laagModel]) =>
        option.fold(
          () => true,
          (zoom: number) => zoom < laagModel.minZoom
        )(neededZoom(map, extent))
      ),
      map(() =>
        prt.ToonMeldingCmd([
          `${this.laagTitel} zijn niet zichtbaar op huidig zoom niveau`,
        ])
      )
    );

    const fieldSelectionToVeldsortering: PartialFunction1<
      FieldSelection,
      Veldsortering
    > = (selection) =>
      pipe(
        selection,
        FieldSelection.maybeSortDirectionLens.get,
        option.map((sd) =>
          Veldsortering.create(pipe(selection, FieldSelection.nameLens.get), sd)
        )
      );

    const sortings: Function1<FieldSelection[], Veldsortering[]> = (
      selections
    ) => pipe(selections, array.filterMap(fieldSelectionToVeldsortering));

    // Dit laat het globaal model ook weten dat er wijzingen zijn aan de FieldSelection. Op die manier kan Geoloket daar
    // naar luisteren en die informatie in zijn view opslaan en desgewenst opslaan. Er is een probleem wanneer de
    // instellingen in het model vlug na elkaar gewijzigd worden. Dan zal de distinctUntil die normalerwijs gelijke
    // updates en een oneindige lus blokkeert (want we luisteren ook op het model) constant wijzingen zien. Daarom is er
    // ook een debounceTime aanwezig. Op die manier krijgt de reducer enkel de stabiele toestand van het LaagModel en
    // wordt een oneindige lus vermeden.
    const veranderLaagInstellingenCmd$ = this.laag$.pipe(
      map(LaagModel.selectedFieldSelectionGetter.get),
      distinctUntilChanged(
        array.getEq(FieldSelection.setoidFieldSelection).equals
      ),
      map((selections) =>
        pipe(
          Laagtabelinstellingen.create(
            this.laagTitel,
            new Set(array.map(FieldSelection.nameLens.get)(selections)),
            sortings(selections)
          ),
          prt.VeranderLaagtabelinstellingenCmd
        )
      ),
      debounceTime(500)
    );

    this.runInViewReady(
      rx
        .merge(
          zoomToSelectionCmd$,
          clearSelectionCmd$,
          toggleRowSelctionCmd$,
          toggleAllRowsSelectionCmd$,
          zoomToIndividualRowCmd$,
          veranderLaagInstellingenCmd$,
          warnZoomToSelectionCmd$,
          warnZoomToIndividualRowCmd$
        )
        .pipe(tap((cmd) => this.dispatch(cmd)))
    );
  }

  handleExtraKnopClick(extraKnop: KnopConfiguratie) {
    this.laag$
      .pipe(take(1))
      .forEach((laag) =>
        this.dispatch(
          prt.LaagTabelExtraKnopCmd(laag, extraKnop.actie, kaartLogOnlyWrapper)
        )
      );
  }
}
