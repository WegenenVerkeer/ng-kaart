import { ChangeDetectionStrategy, Component, ElementRef, Input, NgZone, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatCheckbox } from "@angular/material";
import { array } from "fp-ts";
import * as fpArray from "fp-ts/lib/Array";
import { intercalate } from "fp-ts/lib/Foldable2v";
import { Curried2, flow, Function1, FunctionN, Refinement } from "fp-ts/lib/function";
import { monoidString } from "fp-ts/lib/Monoid";
import * as fpOption from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";
import { distinctUntilChanged, map, mapTo, sample, share, switchMap, tap, withLatestFrom } from "rxjs/operators";
import { isBoolean, isString } from "util";

import { Feature } from "../../util/feature";
import { catOptions, collectOption, subSpy } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as cmd from "../kaart-protocol-commands";
import { DeselecteerAlleFeaturesCmd, DeselecteerFeatureCmd, SelecteerExtraFeaturesCmd } from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";

import { Page, Row } from "./data-provider";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { FieldSelection, LaagModel, TableModel, Update } from "./model";

// Dit is een interface die bedoeld is voor gebruik in de template
interface ColumnHeaders {
  readonly headers: FieldSelection[];
  readonly columnWidths: string; // we willen dit niet in de template opbouwen
}

namespace ColumnHeaders {
  const join: Curried2<string, string[], string> = sep => a => intercalate(monoidString, array.array)(sep, a);

  const create: Function1<FieldSelection[], ColumnHeaders> = fieldSelections => ({
    headers: fieldSelections,
    columnWidths: pipe(
      fieldSelections,
      array.map(_ => "minmax(40px, 200px)"),
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

@Component({
  selector: "awv-feature-tabel-data",
  templateUrl: "./feature-tabel-data.component.html",
  styleUrls: ["./feature-tabel-data.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelDataComponent extends KaartChildComponentBase {
  // Voor de template
  public readonly headers$: rx.Observable<ColumnHeaders>;
  public readonly rows$: rx.Observable<Row[]>;
  public readonly noDataAvailable$: rx.Observable<boolean>;
  public readonly dataAvailable$: rx.Observable<boolean>;
  public readonly fieldNameSelections$: rx.Observable<FieldSelection[]>;

  // Voor child components
  public readonly laag$: rx.Observable<LaagModel>;

  public selectAll = false;

  @Input()
  laagTitel: string;

  @ViewChild("selectAllCheckBox")
  selectAllCheckBox: MatCheckbox;

  constructor(kaart: KaartComponent, overzicht: FeatureTabelOverzichtComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    const model$ = overzicht.model$;

    this.laag$ = subSpy("****laag$")(
      this.viewReady$.pipe(
        // De input is pas beschikbaar nadat de view klaar is
        switchMap(() => model$.pipe(collectOption(TableModel.laagForTitel(this.laagTitel)))),
        share()
      )
    );

    const maybePage$ = this.laag$.pipe(
      map(LaagModel.pageLens.get),
      share()
    );
    const page$ = subSpy("****page$")(maybePage$.pipe(catOptions));

    this.rows$ = subSpy("****row$")(
      page$.pipe(
        map(Page.rowsLens.get),
        share()
      )
    );

    this.noDataAvailable$ = maybePage$.pipe(map(opt => opt.isNone()));
    this.dataAvailable$ = maybePage$.pipe(map(opt => opt.isSome()));

    this.fieldNameSelections$ = subSpy("****fieldNameSelections$")(
      this.laag$.pipe(
        map(laag => laag.fieldSelections),
        // De distinctUntilChanged is OK omdat de eerste kolom disabled staat. Mocht dat niet zo zijn, maar we willen
        // die toch altijd geselecteerd hebben, dan zou het model daar voor zorgen (dat doet het ook), maar als gevolg
        // zou er geen verandering aan het LaagModel zijn en bij gevolg ook geen emit. De checkbox state zou dan niet
        // overeenstemmen met het model.
        distinctUntilChanged(array.getSetoid(FieldSelection.setoidFieldSelection).equals),
        share()
      )
    );

    this.headers$ = subSpy("****headers$")(
      this.fieldNameSelections$.pipe(
        map(ColumnHeaders.createFromFieldSelection),
        share()
      )
    );

    const withLaagTitel: Function1<Function1<string, rx.Observable<Update>>, rx.Observable<Update>> = titelBasedOps =>
      this.laag$.pipe(switchMap(laag => titelBasedOps(laag.titel)));

    const fieldSelectionsUpdate$ = withLaagTitel(titel =>
      rx.merge(
        this.actionFor$("chooseBaseFields").pipe(mapTo(TableModel.chooseBaseFieldsUpdate(titel))),
        this.actionFor$("chooseAllFields").pipe(mapTo(TableModel.chooseAllFieldsUpdate(titel))),
        this.actionDataFor$("toggleField", isFieldSelection).pipe(
          map(fieldSelection => TableModel.setFieldSelectedUpdate(titel)(fieldSelection.name, !fieldSelection.selected))
        )
      )
    );

    const sortUpdate$ = withLaagTitel(titel =>
      this.actionDataFor$("toggleSort", isString).pipe(map(fieldName => TableModel.sortFieldToggleUpdate(titel)(fieldName)))
    );

    const doUpdate$ = rx.merge(fieldSelectionsUpdate$, sortUpdate$).pipe(tap(overzicht.updater));

    this.runInViewReady(rx.merge(doUpdate$));

    const selectAll$ = this.actionDataFor$("selectAll", isBoolean);
    const selectRow$ = this.rawActionDataFor$("selectRow");

    const extractIds: FunctionN<[Row], string> = row => {
      return [row]
        .map(row => Feature.propertyId(row.feature))
        .filter(fpOption.isSome)
        .map(fpOption.getOrElse(() => ""))[0];
    };

    // uncheck de selectAll indien de rijen veranderen
    this.runInViewReady(
      this.rows$.pipe(
        tap(() => {
          if (this.selectAllCheckBox) {
            this.selectAllCheckBox.checked = false;
          }
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
          if (geselecteerdeFeatures.verwijderd.length > 0) {
            if (this.selectAllCheckBox) {
              this.selectAllCheckBox.checked = false;
            }
          }
        })
      )
    );

    // (de)selecteer een enkele rij
    this.runInViewReady(
      selectRow$.pipe(
        tap(data => {
          const row = data.row as Row;
          if (this.selectAllCheckBox) {
            this.selectAllCheckBox.checked = false;
          }
          if (data.selected) {
            this.dispatch(SelecteerExtraFeaturesCmd([row.feature]));
          } else {
            const ids = extractIds(row);
            this.dispatch(DeselecteerFeatureCmd([ids]));
          }
        })
      )
    );

    // (de)selecteer alle rijen
    this.runInViewReady(
      selectAll$.pipe(
        withLatestFrom(this.rows$),
        tap(([selected, _rows]) => {
          const rows = _rows as Array<Row>;
          if (selected) {
            this.dispatch(SelecteerExtraFeaturesCmd(rows.map(row => row.feature)));
          } else {
            const ids = rows.map(extractIds);
            this.dispatch(DeselecteerFeatureCmd(ids));
          }
        })
      )
    );
  }

  public numberOfSelectedFeatures$ = this.modelChanges.geselecteerdeFeatures$.pipe(
    map(features => {
      return features.geselecteerd.filter(f => {
        return f.getProperties()["laagnaam"] === this.laagTitel;
      }).length;
    })
  );

  // dit wordt wel heel vaak opgeroepen, geen perf issues?
  public isSelected$ = row => this.kaartModel$.pipe(map(m => m.geselecteerdeFeatures.features.getArray().includes(row.feature)));
}
