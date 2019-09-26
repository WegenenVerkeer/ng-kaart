import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, NgZone, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { flow, Function1, not, Refinement } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, map, mapTo, share, startWith, switchMap, take, tap } from "rxjs/operators";
import { isBoolean, isString } from "util";

import { catOptions, subSpy } from "../../util/operators";
import { join } from "../../util/string";
import { KaartChildComponentBase } from "../kaart-child-component-base";
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
  public readonly mapAsFilterState$: rx.Observable<boolean>;
  public readonly cannotChooseMapAsFilter$: rx.Observable<boolean>;

  // Voor child components
  public readonly laag$: rx.Observable<LaagModel>;

  @Input()
  laagTitel: string;

  constructor(kaart: KaartComponent, overzicht: FeatureTabelOverzichtComponent, ngZone: NgZone, private readonly cdr: ChangeDetectorRef) {
    super(kaart, ngZone);

    this.laag$ = subSpy("****laag$")(
      this.viewReady$.pipe(
        // De input is pas beschikbaar nadat de view klaar is
        switchMap(() => overzicht.laagModel$(this.laagTitel)),
        share()
      )
    );

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

    this.fieldNameSelections$ = this.laag$.pipe(
      map(laag => laag.fieldSelections),
      // De distinctUntilChanged is OK omdat de eerste kolom disabled staat. Mocht dat niet zo zijn, maar we willen
      // die toch altijd geselecteerd hebben, dan zou het model daar voor zorgen (dat doet het ook), maar als gevolg
      // zou er geen verandering aan het LaagModel zijn en bij gevolg ook geen emit. De checkbox state zou dan niet
      // overeenstemmen met het model.
      distinctUntilChanged(array.getSetoid(FieldSelection.setoidFieldSelection).equals),
      share()
    );

    this.headers$ = this.fieldNameSelections$.pipe(
      map(ColumnHeaders.createFromFieldSelection),
      share()
    );

    this.cannotChooseMapAsFilter$ = this.laag$.pipe(map(not(LaagModel.canUseAllFeaturesGetter.get)));

    this.mapAsFilterState$ = this.laag$.pipe(
      map(LaagModel.mapAsFilterGetter.get),
      debounceTime(40),
      // De hack hieronder is nodig omdat Angular's change detection het equivalent van een distinctUntilChanged doet.
      // Maw, als de waarde uit de observable niet verandert, dan gebeurt er niks. Ook niet als de gebruiker manueel de
      // waarde aangepast heeft. Een eenvoudige rx.of(!onOff, onOff) is overigens niet voldoende omdat er intern ook het
      // equivalent van een debounceTime gebeurt.
      switchMap(onOff =>
        rx.timer(0, 1).pipe(
          take(2),
          map(i => (i % 2 === 0 ? !onOff : onOff))
        )
      ),
      share()
    );

    const fieldSelectionsUpdate$ = rx.merge(
      this.actionFor$("chooseBaseFields").pipe(mapTo(LaagModel.chooseBaseFieldsUpdate)),
      this.actionFor$("chooseAllFields").pipe(mapTo(LaagModel.chooseAllFieldsUpdate)),
      this.actionDataFor$("toggleField", isFieldSelection).pipe(
        map(fieldSelection => LaagModel.setFieldSelectedUpdate(fieldSelection.name, !fieldSelection.selected))
      )
    );

    const sortUpdate$ = this.actionDataFor$("toggleSort", isString).pipe(map(LaagModel.sortFieldToggleUpdate));

    const viewModeUpdate$ = this.actionDataFor$("mapAsFilter", isBoolean).pipe(map(LaagModel.mapAsFilterUpdate));

    const doUpdate$ = (titel: string) =>
      rx
        .merge(fieldSelectionsUpdate$, sortUpdate$, viewModeUpdate$, totalFeaturesUpdate$, directPageUpdates$)
        .pipe(tap(overzicht.laagUpdater(titel)));

    this.runInViewReady(rx.defer(() => doUpdate$(this.laagTitel)));
  }
}
