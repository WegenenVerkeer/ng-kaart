import { ChangeDetectionStrategy, Component, Input, NgZone, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { Function1, Refinement } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { distinctUntilChanged, map, mapTo, share, switchMap, tap } from "rxjs/operators";

import { catOptions, collectOption, subSpy } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { Page, Row } from "./data-provider";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { ColumnHeaders, FieldSelection, LaagModel, TableModel, Update } from "./model";

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
  public readonly menuOpenState$: rx.Observable<string>;

  // Voor child components
  public readonly laag$: rx.Observable<LaagModel>;

  @Input()
  laagTitel: string;

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

    this.headers$ = subSpy("****headers$")(
      this.laag$.pipe(
        map(LaagModel.headersGetter.get),
        distinctUntilChanged(ColumnHeaders.setoidColumnHeaders.equals),
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
        distinctUntilChanged(array.getSetoid(FieldSelection.setoidFieldSelection).equals)
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

    const doUpdate$ = fieldSelectionsUpdate$.pipe(tap(overzicht.updater));

    this.menuOpenState$ = rx.merge(
      this.actionFor$("showSelections").pipe(mapTo("opened")),
      this.actionFor$("hideSelections").pipe(mapTo("closed"))
    );

    this.runInViewReady(rx.merge(doUpdate$));
  }
}
