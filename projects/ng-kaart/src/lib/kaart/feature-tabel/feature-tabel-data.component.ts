import { ChangeDetectionStrategy, Component, Input, NgZone, OnChanges, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatCheckbox } from "@angular/material/checkbox";
import { array, option } from "fp-ts";
import { flow, Function1, Refinement } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map, mapTo, share, shareReplay, startWith, switchMap, tap, withLatestFrom } from "rxjs/operators";
import { arraysAreEqual } from "tslint/lib/utils";
import { isBoolean, isString } from "util";

import { Feature } from "../../util/feature";
import { subSpy } from "../../util/operators";
import { join } from "../../util/string";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { DeselecteerFeatureCmd, SelecteerExtraFeaturesCmd, VeranderExtentCmd } from "../kaart-protocol-commands";
import { FeatureSelection } from "../kaart-protocol-subscriptions";
import { KaartComponent } from "../kaart.component";

import { Page } from "./data-provider";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { FieldSelection } from "./field-selection-model";
import { LaagModel } from "./laag-model";
import { Row } from "./row-model";
import { Update } from "./update";

// Dit is een interface die bedoeld is voor gebruik in de template
interface ColumnHeaders {
  readonly headers: FieldSelection[];
  readonly columnWidths: string; // we willen dit niet in de template opbouwen
}

namespace ColumnHeaders {
  const create: Function1<FieldSelection[], ColumnHeaders> = fieldSelections => ({
    headers: fieldSelections,
    columnWidths: pipe(
      fieldSelections,
      array.map(_ => "minmax(150px, 400px)"),
      join(" ")
    )
  });

  export const createFromFieldSelection: Function1<FieldSelection[], ColumnHeaders> = flow(
    array.filter(FieldSelection.selectedLens.get),
    create
  );
}

const isFieldSelection: Refinement<any, FieldSelection> = (fieldSelection): fieldSelection is FieldSelection =>
  fieldSelection.hasOwnProperty("selected") && fieldSelection.hasOwnProperty("name");

interface TemplateData {
  readonly dataAvailable: boolean;
  readonly fieldNameSelections: FieldSelection[];
  readonly headers: ColumnHeaders;
  readonly rows?: Row[];
  readonly mapAsFilterState: boolean;
  readonly cannotChooseMapAsFilter: boolean;
  readonly updatePending: boolean;
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

  public selectAllChecked = false;

  @Input()
  laagTitel: string;

  constructor(kaart: KaartComponent, overzicht: FeatureTabelOverzichtComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    this.laag$ = subSpy("****laag$")(
      this.viewReady$.pipe(
        // De input is pas beschikbaar nadat de view klaar is
        switchMap(() => overzicht.laagModel$(this.laagTitel)),
        share()
      )
    ).pipe(shareReplay(1)); // De pager zit in een *ngIf, dus subscribe na emit

    // TODO luisteren op filterupdates
    // Dit zorgt enkel voor het al dan niet kunnen schakelen tussen kaart als filter en alle data
    const totalFeaturesUpdate$: rx.Observable<LaagModel.LaagModelUpdate> = rx.of(LaagModel.followTotalFeaturesUpdate); // equiv. startWith

    // Voor de kaart als filter kunnen we gewoon de zichtbare features volgen. Het model zal de updates neutraliseren als
    // het niet in de kaart als filter mode is.
    const directPageUpdates$: rx.Observable<LaagModel.LaagModelUpdate> = subSpy("****directPageUpdates$")(
      this.modelChanges.viewinstellingen$ // OL past collectie niet aan voor elke zoom/pan, dus moeten we update forceren
        .pipe(
          mapTo(null), // Om startWith te kunnen doen
          startWith(null), // We willen direct bij subscribe emitten
          map(() =>
            Update.mappend(
              // Eerst de "geforceerde" update
              LaagModel.sourceFeaturesUpdate,
              // Dan volgen van de features in de view (wat dus niks oplevert als er geen nieuwe features van de backend komen)
              LaagModel.followViewFeatureUpdates
            )
          )
        )
    );

    // Alle data voor de template wordt in 1 custom datastructuur gegoten. Dat heeft als voordeel dat er geen gezever is
    // met observables die binnen *ngIf staan. Het nadeel is frequentere updates omdat er geen distinctUntil is. Die zou
    // immers de rows array moeten meenemen.
    this.templateData$ = subSpy("****templateData$")(
      this.laag$.pipe(
        map(laag => {
          const fieldNameSelections = LaagModel.fieldSelectionsLens.get(laag);
          const rows = option.toUndefined(LaagModel.pageLens.get(laag).map(Page.rowsLens.get));
          return {
            dataAvailable: rows !== undefined,
            fieldNameSelections,
            headers: ColumnHeaders.createFromFieldSelection(fieldNameSelections),
            rows,
            mapAsFilterState: LaagModel.viewSourceModeGetter.get(laag) === "Map",
            cannotChooseMapAsFilter: !LaagModel.canUseAllFeaturesGetter.get(laag),
            updatePending: LaagModel.updatePendingLens.get(laag)
          };
        })
      )
    );

    this.rows$ = subSpy("****rows$")(
      this.laag$.pipe(
        map(laag =>
          LaagModel.pageLens
            .get(laag)
            .map(Page.rowsLens.get)
            .getOrElse([])
        )
      )
    );

    const fieldSelectionsUpdate$ = rx.merge(
      this.actionFor$("chooseBaseFields").pipe(mapTo(LaagModel.chooseBaseFieldsUpdate)),
      this.actionFor$("chooseAllFields").pipe(mapTo(LaagModel.chooseAllFieldsUpdate)),
      this.actionDataFor$("toggleField", isFieldSelection).pipe(
        map(fieldSelection => LaagModel.setFieldSelectedUpdate(fieldSelection.name, !fieldSelection.selected))
      )
    );

    const sortUpdate$ = this.actionDataFor$("toggleSort", isString).pipe(map(LaagModel.sortFieldToggleUpdate));

    const viewModeUpdate$ = this.actionDataFor$("mapAsFilter", isBoolean).pipe(map(LaagModel.setMapAsFilterUpdate));

    const doUpdate$ = (titel: string) =>
      rx
        .merge(fieldSelectionsUpdate$, sortUpdate$, viewModeUpdate$, totalFeaturesUpdate$, directPageUpdates$)
        .pipe(tap(overzicht.laagUpdater(titel)));

    this.runInViewReady(rx.defer(() => doUpdate$(this.laagTitel)));
    this.runInViewReady(rx.merge(doUpdate$));

    const selectAll$ = this.actionDataFor$("selectAll", isBoolean);
    const selectRow$ = this.rawActionDataFor$("selectRow");
    const eraseSelection$ = this.actionFor$("eraseSelection");
    const zoomToSelection$ = this.actionFor$("zoomToSelection");

    // zoom naar de selectie
    this.runInViewReady(
      zoomToSelection$.pipe(
        withLatestFrom(this.kaartModel$),
        tap(([x, model]) => {
          const selection = FeatureSelection.getGeselecteerdeFeaturesInLaag(model.geselecteerdeFeatures)(this.laagTitel);

          const extent = selection[0].getGeometry().getExtent();
          selection.forEach(feature => ol.extent.extend(extent, feature.getGeometry().getExtent()));

          this.dispatch(VeranderExtentCmd(extent));
        })
      )
    );

    // hou in de row bij of die geselecteerd is of niet
    // kan dus veranderen als de rijen veranderen, of de selection veranderd
    this.runInViewReady(
      rx.combineLatest([this.rows$, this.modelChanges.geselecteerdeFeatures$]).pipe(
        withLatestFrom(this.kaartModel$),
        tap(([[rows, selection], model]) => {
          rows.forEach(r => (r.selected = FeatureSelection.isSelected(model.geselecteerdeFeatures)(r.feature)));
        })
      )
    );

    // wis volledige selectie voor deze laag
    this.runInViewReady(
      eraseSelection$.pipe(
        withLatestFrom(this.kaartModel$),
        tap(([x, model]) => {
          const selected = model.geselecteerdeFeatures.features.getArray().filter(f => f.getProperties()["laagnaam"] === this.laagTitel);
          this.dispatch(DeselecteerFeatureCmd(selected.map(Feature.propertyIdRequired)));
        })
      )
    );

    // uncheck de selectAll indien de rijen veranderen
    this.runInViewReady(
      this.rows$.pipe(
        tap(() => {
          this.selectAllChecked = false;
        })
      )
    );

    // uncheck de select all indien een rij ge(de)selecteerd wordt via de kaart
    this.runInViewReady(
      this.modelChanges.geselecteerdeFeatures$.pipe(
        tap(geselecteerdeFeatures => {
          // als we via de kaart selecteren en we hadden reeds alles geselecteerd
          // zijn er zeker items verwijderd
          // zelfs als multi select aanstaat kunnen er geen bijgekomen zijn zonder dat rows$ ging veranderd zijn
          // en die legt ook de selectAll af
          if (array.isNonEmpty(geselecteerdeFeatures.verwijderd.length)) {
            this.selectAllChecked = false;
          }
        })
      )
    );

    // (de)selecteer een enkele rij
    this.runInViewReady(
      selectRow$.pipe(
        tap(data => {
          this.selectAllChecked = false;
          if (data.selected) {
            this.dispatch(SelecteerExtraFeaturesCmd([data.row.feature]));
          } else {
            const ids = Feature.propertyIdRequired(data.row.feature);
            this.dispatch(DeselecteerFeatureCmd([ids]));
          }
        })
      )
    );

    // (de)selecteer alle rijen
    this.runInViewReady(
      selectAll$.pipe(
        withLatestFrom(this.rows$),
        tap(([selected, rows]) => {
          this.selectAllChecked = selected;
          if (selected) {
            this.dispatch(SelecteerExtraFeaturesCmd(rows.map(row => row.feature)));
          } else {
            const ids = rows.map(row => row.feature).map(Feature.propertyIdRequired);
            this.dispatch(DeselecteerFeatureCmd(ids));
          }
        })
      )
    );
  }

  public readonly numberOfSelectedFeatures$ = this.modelChanges.geselecteerdeFeatures$.pipe(
    withLatestFrom(this.kaartModel$),
    map(([features, model]) => {
      return FeatureSelection.selectedFeaturesIdsInLaag(model.geselecteerdeFeatures)(this.laagTitel).size;
    }),
    startWith(0),
    shareReplay(1)
  );

  public readonly hasSelectedFeatures$ = this.numberOfSelectedFeatures$.pipe(map(count => count > 0));
}
