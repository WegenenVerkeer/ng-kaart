import { ChangeDetectionStrategy, Component, Input, NgZone, ViewEncapsulation } from "@angular/core";
import { array, option } from "fp-ts";
import { flow, Function1, Function2, Refinement } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, map, mapTo, share, shareReplay, startWith, switchMap, take, tap, withLatestFrom } from "rxjs/operators";
import { isBoolean, isString } from "util";

import * as arrays from "../../util/arrays";
import { join } from "../../util/string";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

import { Page } from "./data-provider";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
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
  const create: Function1<FieldSelection[], ColumnHeaders> = fieldSelections => ({
    headers: fieldSelections,
    columnWidths: pipe(
      fieldSelections,
      array.map(fs => fs.contributingVeldinfos.length),
      array.map(numFields => `minmax(${140 + (numFields - 1) * 35}px, 400px)`),
      join(" ")
    )
  });

  export const createFromFieldSelection: Function1<FieldSelection[], ColumnHeaders> = flow(
    array.filter(FieldSelection.selectedLens.get),
    create
  );
}

const neededZoom: Function2<ol.Map, ol.Extent, number> = (map, extent) =>
  map.getView().getZoomForResolution(map.getView().getResolutionForExtent(extent, map.getSize()));

const isFieldSelection: Refinement<any, FieldSelection> = (fieldSelection): fieldSelection is FieldSelection =>
  fieldSelection.hasOwnProperty("selected") && fieldSelection.hasOwnProperty("name");

interface TemplateData {
  readonly dataAvailable: boolean;
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelDataComponent extends KaartChildComponentBase {
  // Voor de template
  public readonly templateData$: rx.Observable<TemplateData>;
  public readonly rows$: rx.Observable<Row[]>;
  // Voor child components
  public readonly laag$: rx.Observable<LaagModel>;

  @Input()
  laagTitel: string;

  constructor(kaart: KaartComponent, overzicht: FeatureTabelOverzichtComponent, ngZone: NgZone) {
    super(kaart, ngZone);

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
    const totalFeaturesUpdate$: rx.Observable<LaagModel.LaagModelUpdate> = rx.of(LaagModel.getTotalFeaturesUpdate);

    const numGeselecteerdeFeatures$ = this.inViewReady(() =>
      this.modelChanges.geselecteerdeFeatures$.pipe(
        map(prt.FeatureSelection.selectedFeaturesInLaagSize(this.laagTitel)),
        startWith(0)
      )
    );

    // Alle data voor de template wordt in 1 custom datastructuur gegoten. Dat heeft als voordeel dat er geen gezever is
    // met observables die binnen *ngIf staan. Het nadeel is frequentere updates omdat er geen distinctUntil is. Die zou
    // immers de rows array moeten meenemen.
    this.templateData$ = rx.combineLatest(layoutMode$, this.laag$, numGeselecteerdeFeatures$).pipe(
      map(([layoutMode, laagModel, numGeselecteerdeFeatures]) => {
        const fieldNameSelections = LaagModel.fieldSelectionsGetter.get(laagModel);
        const showOnlySelectedFeatures = LaagModel.selectionViewModeGetter.get(laagModel) === "SelectedOnly";
        const maybeRows = LaagModel.pageGetter.get(laagModel).map(Page.rowsLens.get);
        const rows = option.toUndefined(maybeRows); // -> handiger in template
        const allRowsSelected =
          showOnlySelectedFeatures ||
          pipe(
            maybeRows,
            option.exists(arrays.forAll(row => !!row.selected))
          );
        const allFieldsSelected = arrays.forAll(FieldSelection.selectedLens.get)(laagModel.fieldSelections);
        return {
          dataAvailable: rows !== undefined,
          fieldNameSelections,
          headers: ColumnHeaders.createFromFieldSelection(fieldNameSelections),
          rows,
          mapAsFilterState: LaagModel.viewSourceModeGetter.get(laagModel) === "Map",
          cannotChooseMapAsFilter: !LaagModel.canUseAllFeaturesGetter.get(laagModel),
          updatePending: LaagModel.updatePendingGetter.get(laagModel),
          numGeselecteerdeFeatures,
          hasSelectedFeatures: numGeselecteerdeFeatures > 0,
          showOnlySelectedFeatures,
          allRowsSelected,
          allFieldsSelected,
          comfortableLayout: layoutMode === "Comfortable"
        };
      }),
      share()
    );

    this.rows$ = this.laag$.pipe(
      map(laag =>
        LaagModel.pageGetter
          .get(laag)
          .map(Page.rowsLens.get)
          .getOrElse([])
      )
    );

    const fieldSelectionsUpdate$ = rx.merge(
      this.actionFor$("chooseBaseFields").pipe(mapTo(LaagModel.chooseBaseFieldsUpdate)),
      this.actionFor$("chooseAllFields").pipe(mapTo(LaagModel.chooseAllFieldsUpdate)),
      this.actionFor$("chooseNoFields").pipe(mapTo(LaagModel.chooseNoFieldsUpdate)),
      this.actionDataFor$("toggleField", isFieldSelection).pipe(
        map(fieldSelection => LaagModel.setFieldSelectedUpdate(fieldSelection.name, !fieldSelection.selected))
      ),
      this.actionFor$("showOnlySelectedFeatures").pipe(mapTo(LaagModel.setShowSelectedOnlyUpdate(true))),
      this.actionFor$("showAllFeatures").pipe(mapTo(LaagModel.setShowSelectedOnlyUpdate(false)))
    );

    const sortUpdate$ = this.actionDataFor$("toggleSort", isString).pipe(map(LaagModel.sortFieldToggleUpdate));

    const viewModeUpdate$ = this.actionDataFor$("mapAsFilter", isBoolean).pipe(map(LaagModel.setMapAsFilterUpdate));

    const doUpdate$ = (titel: string) =>
      rx.merge(fieldSelectionsUpdate$, sortUpdate$, viewModeUpdate$, totalFeaturesUpdate$).pipe(tap(overzicht.laagUpdater(titel)));

    this.runInViewReady(rx.defer(() => doUpdate$(this.laagTitel)));

    const selectAll$ = this.actionDataFor$("selectAll", isBoolean);
    const selectRow$ = this.rawActionDataFor$("selectRow") as rx.Observable<RowSelection>;
    const eraseSelection$ = this.actionFor$("eraseSelection");
    const zoomToSelection$ = this.actionFor$("zoomToSelection");
    const zoomToRow$ = this.actionDataFor$("zoomToRow", (r): r is Row => true);

    const olMap$ = this.kaartModel$.pipe(
      map(m => m.map),
      take(1)
    );

    // zoom naar de selectie
    this.runInViewReady(
      zoomToSelection$.pipe(
        withLatestFrom(this.modelChanges.geselecteerdeFeatures$, olMap$, this.laag$),
        tap(([_, selection, map, laagModel]) => {
          const laagSelection = prt.FeatureSelection.getGeselecteerdeFeaturesInLaag(this.laagTitel)(selection);
          const extent = laagSelection[0].getGeometry().getExtent();
          laagSelection.forEach(feature => ol.extent.extend(extent, feature.getGeometry().getExtent()));
          this.dispatch(prt.VeranderExtentCmd(extent));

          if (neededZoom(map, extent) < laagModel.minZoom || neededZoom(map, extent) > laagModel.maxZoom) {
            this.dispatch(
              prt.ToonMeldingCmd([
                laagSelection.length > 1
                  ? "Extent van de features is te groot voor huidig zoom niveau"
                  : "Feature is niet zichtbaar op huidig zoom niveau"
              ])
            );
          }
        })
      )
    );

    // hou in de row bij of die geselecteerd is of niet
    // kan dus veranderen als de rijen veranderen, of de selection verandert
    this.runInViewReady(
      rx.combineLatest([this.rows$, this.modelChanges.geselecteerdeFeatures$]).pipe(
        tap(([rows, selection]: [Row[], prt.GeselecteerdeFeatures]) => {
          rows.forEach(r => {
            r.selected = prt.FeatureSelection.isSelected(selection)(r.feature);
          });
        })
      )
    );

    // wis volledige selectie voor deze laag
    this.runInViewReady(
      eraseSelection$.pipe(
        withLatestFrom(this.modelChanges.geselecteerdeFeatures$),
        tap(([_, geselecteerdeFeatures]) => {
          const selectedIds = prt.FeatureSelection.getGeselecteerdeFeatureIdsInLaag(this.laagTitel)(geselecteerdeFeatures);
          this.dispatch(prt.DeselecteerFeatureCmd(selectedIds));
        })
      )
    );

    // (de)selecteer een enkele rij
    this.runInViewReady(
      selectRow$.pipe(
        tap((rowSelection: RowSelection) => {
          if (rowSelection.selected) {
            this.dispatch(prt.SelecteerExtraFeaturesCmd([rowSelection.row.feature.feature]));
          } else {
            this.dispatch(prt.DeselecteerFeatureCmd([rowSelection.row.feature.id]));
          }
        })
      )
    );

    // (de)selecteer alle rijen
    this.runInViewReady(
      selectAll$.pipe(
        withLatestFrom(this.rows$),
        tap(([selected, rows]: [boolean, Row[]]) => {
          if (selected) {
            this.dispatch(prt.SelecteerExtraFeaturesCmd(rows.map(row => row.feature.feature)));
          } else {
            const ids = rows.map(row => row.feature.id);
            this.dispatch(prt.DeselecteerFeatureCmd(ids));
          }
        })
      )
    );

    // zoom naar individuele rij
    this.runInViewReady(
      zoomToRow$.pipe(
        withLatestFrom(olMap$, this.laag$),
        tap(([row, map, laagModel]) => {
          const extent = row.feature.feature.getGeometry().getExtent();
          this.dispatch(prt.VeranderExtentCmd(extent));

          if (neededZoom(map, extent) < laagModel.minZoom || neededZoom(map, extent) > laagModel.maxZoom) {
            this.dispatch(prt.ToonMeldingCmd(["Feature is niet zichtbaar op huidig zoom niveau"]));
          }
        })
      )
    );
  }
}
