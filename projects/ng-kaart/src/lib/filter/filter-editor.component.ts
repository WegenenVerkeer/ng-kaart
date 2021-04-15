import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
} from "@angular/core";
import { FormControl, ValidationErrors, Validators } from "@angular/forms";
import { MatAutocompleteTrigger } from "@angular/material/autocomplete";
import { apply, array, option, ord } from "fp-ts";
import { Endomorphism, Refinement } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/function";
import { DateTime } from "luxon";
import * as momentImported from "moment";
import * as rx from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  sample,
  scan,
  share,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
  withLatestFrom,
} from "rxjs/operators";

import { KaartChildDirective } from "../kaart/kaart-child.directive";
import { mobile } from "../kaart/kaart-config";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { asap } from "../util/asap";
import { isNotNull, isNotNullObject } from "../util/function";
import { isOfKind } from "../util/kinded";
import { parseDouble, parseInteger } from "../util/number";
import { catOptions, forEvery } from "../util/operators";
import { isString, nonEmptyString } from "../util/string";

import {
  FilterAanpassingBezig,
  isAanpassingBezig,
} from "./filter-aanpassing-state";
import { FilterEditor, FilterEditor as fed } from "./filter-builder";
import { Filter, Filter as fltr } from "./filter-model";

import setoidComparisonOperator = FilterEditor.setoidComparisonOperator;
import setoidPropertyByRef = Filter.setoidPropertyByRef;

const moment = momentImported;

const autoCompleteSelectieVerplichtValidator: (
  arg: FormControl
) => ValidationErrors | null = (control) => {
  if (typeof control.value === "string") {
    return { required: {} };
  }
  return null;
};

const ordPropertyByBaseField: (
  veldinfos: Map<string, ke.VeldInfo>
) => ord.Ord<Filter.Property> = (veldinfos) =>
  ord.contramap((prop: Filter.Property) =>
    ke.VeldInfo.veldInfoOpNaam(prop.ref, veldinfos)
  )(option.getOrd(ord.getDualOrd(ke.VeldInfo.ordVeldOpBasisVeld)));

const enableDisabled = (...controls: FormControl[]): void => {
  controls.forEach((control) => {
    if (control.disabled) {
      control.enable({ emitEvent: false });
    }
  });
};

const disableEnabled = (...controls: FormControl[]): void => {
  controls.forEach((control) => {
    if (control.enabled) {
      control.disable({ emitEvent: false });
    }
  });
};

const resetWithoutEvent = (...controls: FormControl[]): void => {
  controls.forEach((control) => control.reset("", { emitEvent: false }));
};

const sanitiseText: Endomorphism<string> = (text) =>
  text.trim().replace(/[\x00-\x1F]/g, "");

// We willen fragmenten van waarden scheiden van volledige waarden. Dat doen we liefst zonder steeds te controleren tov
// de volledige lijst van waarden. Die lijst is immers niet eenvoudig voorhanden. De manier die hier gebruiken is om
// waarden in een object te wrappen om zo het verschil met een string te detecteren.
interface Wrapped {
  readonly value: string;
}

const Wrapped: (arg: string) => Wrapped = (value) => ({ value });
const isWrapped: Refinement<any, Wrapped> = (obj): obj is Wrapped =>
  obj && obj.value && typeof obj.value === "string";
const extractValue: (arg: Wrapped) => string = (wrapped) => wrapped.value;

type CheckboxState = "caseSensitive" | "activateKeyboard" | "none";
type ActieveAutoComplete = "eigenschap" | "waarde";
type InputFocus = "eigenschap" | "operator" | "waarde" | "plainTextWaarde";

@Component({
  selector: "awv-filter-editor",
  templateUrl: "./filter-editor.component.html",
  styleUrls: ["./filter-editor.component.scss"],
})
export class FilterEditorComponent extends KaartChildDirective {
  readonly onMobileDevice = mobile;

  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;
  readonly keyboardActive$: rx.Observable<boolean>;

  readonly filteredVelden$: rx.Observable<Filter.Property[]>;
  readonly properties$: rx.Observable<Filter.Property[]>;
  readonly operators$: rx.Observable<FilterEditor.ComparisonOperator[]>;
  readonly filteredWaarden$: rx.Observable<Wrapped[]>;

  readonly naamControl = new FormControl("");
  readonly veldControl = new FormControl("", [
    Validators.required,
    autoCompleteSelectieVerplichtValidator,
  ]);
  // Als we het oude gedrag weer willen waar de operator direct op '=' staat, dan moeten we de selectedOperator
  // doorschuiven naar FieldSelection
  readonly operatorControl = new FormControl(null, [
    Validators.required,
    autoCompleteSelectieVerplichtValidator,
  ]);
  readonly textWaardeControl = new FormControl(
    { value: null, disabled: true },
    [Validators.required]
  );
  readonly integerWaardeControl = new FormControl(
    { value: null, disabled: true },
    [Validators.required]
  );
  readonly doubleWaardeControl = new FormControl({ value: null });

  readonly hoofdLetterGevoeligControl = new FormControl({
    value: null,
    disabled: true,
  });
  readonly forceAutoCompleteControl = new FormControl({
    value: false,
    disabled: false,
  });

  readonly dropdownWaardeControl = new FormControl(
    { value: null, disabled: true },
    [Validators.required]
  );
  readonly autocompleteWaardeControl = new FormControl(
    { value: null, disabled: true },
    [Validators.required]
  );

  readonly datumWaardeControl = new FormControl(
    { value: null, disabled: true },
    [Validators.required]
  );

  readonly rangeMagnitudeWaardeControl = new FormControl(
    { value: null, disabled: true },
    [Validators.required]
  );
  readonly rangeUnitWaardeControl = new FormControl(
    { value: null, disabled: true },
    [Validators.required]
  );

  readonly ongeldigeFilter$: rx.Observable<boolean>;

  readonly filterEditor$: rx.Observable<FilterEditor.ExpressionEditor>;

  readonly veldwaardeType$: rx.Observable<FilterEditor.ValueSelector>;

  readonly kanHuidigeEditorVerwijderen$: rx.Observable<boolean>;

  readonly newFilterEditor$ = new rx.Subject<
    Endomorphism<FilterEditor.ExpressionEditor>
  >();

  private clickInsideDialog = false;

  readonly checkboxState$: rx.Observable<CheckboxState>;
  private actieveAutoComplete$: rx.Observable<ActieveAutoComplete>;

  // in angular 8 kan de setter vervangen worden door {static: false}
  // we hebben dit nodig omdat de input velden er niet altijd zijn (afhankelijk van keyboardActive$)
  @ViewChild("eigenschapAutocompleteTrigger")
  set setEigenschapAutocompleteTrigger(content: MatAutocompleteTrigger) {
    this.eigenschapAutocompleteTrigger = content;
  }

  @ViewChild("waardeAutocompleteTrigger") set setWaardeAutocompleteTrigger(
    content: MatAutocompleteTrigger
  ) {
    this.waardeAutocompleteTrigger = content;
  }

  @ViewChild("eigenschapAutocompleteInput") set setEigenschapAutocompleteInput(
    content: ElementRef
  ) {
    if (content) {
      this.eigenschapAutocompleteInput = content.nativeElement;
    }
  }

  @ViewChild("waardeAutocompleteInput") set setWaardeAutocompleteInput(
    content: ElementRef
  ) {
    if (content) {
      this.waardeAutocompleteInput = content.nativeElement;
    }
  }
  private eigenschapAutocompleteTrigger: MatAutocompleteTrigger;
  private waardeAutocompleteTrigger: MatAutocompleteTrigger;
  private eigenschapAutocompleteInput: HTMLInputElement;
  private waardeAutocompleteInput: HTMLInputElement;

  public operatorCompare = setoidComparisonOperator.equals;
  public veldCompare = setoidPropertyByRef.equals;

  constructor(
    kaart: KaartComponent,
    zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    super(kaart, zone);

    this.zichtbaar$ = kaart.modelChanges.laagfilteraanpassingState$.pipe(
      map(isAanpassingBezig)
    );

    const aanpassing$: rx.Observable<FilterAanpassingBezig> = kaart.modelChanges.laagfilteraanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
    );

    const laag$: rx.Observable<ke.ToegevoegdeVectorLaag> = aanpassing$.pipe(
      map((aanpassing) => aanpassing.laag), // Neemt de laag op het moment dat de gebruiker de aanpassing vroeg. Ok in dit geval.
      shareReplay(1)
    );

    const veldinfos$ = laag$.pipe(
      map(ke.ToegevoegdeVectorLaag.veldInfosMapLens.get),
      share()
    );

    this.titel$ = laag$.pipe(map((laag) => laag.titel));

    const forEveryLaag = forEvery(laag$);

    const forControlValue: (arg: FormControl) => rx.Observable<any> = (
      formcontrol
    ) =>
      forEveryLaag(() =>
        formcontrol.valueChanges.pipe(
          filter(() => formcontrol.enabled),
          share()
        )
      );

    this.keyboardActive$ = rx
      .merge(forControlValue(this.forceAutoCompleteControl), rx.of(false))
      .pipe(
        map((force) => !this.onMobileDevice || force), // altijd actief indien niet op mobiel toestel
        shareReplay(1)
      );

    laag$.subscribe(() => {
      this.naamControl.reset("", { emitEvent: false });
      this.veldControl.reset("", { emitEvent: false });
      this.operatorControl.reset(null, { emitEvent: false });
      this.textWaardeControl.reset("", { emitEvent: false });
      this.integerWaardeControl.reset(0, { emitEvent: false });
      this.doubleWaardeControl.reset(0, { emitEvent: false });
      this.dropdownWaardeControl.reset("", { emitEvent: false });
      this.datumWaardeControl.reset(null, { emitEvent: false });
      this.autocompleteWaardeControl.reset("", { emitEvent: false });
      this.hoofdLetterGevoeligControl.reset(null, { emitEvent: false });
      this.forceAutoCompleteControl.reset(false, { emitEvent: true });
    });

    const gekozenNaam$: rx.Observable<option.Option<string>> = forControlValue(
      this.naamControl
    )
      .pipe(
        debounceTime(100), // voor de snelle typers
        distinctUntilChanged(),
        map((x) =>
          pipe(
            option.fromNullable(x),
            option.filter((x: string) => x !== "")
          )
        )
      )
      .pipe(share());

    const gekozenProperty$: rx.Observable<Filter.Property> = forControlValue(
      this.veldControl
    ).pipe(
      filter(isNotNullObject),
      distinctUntilChanged() // gebruikt object identity, maar de onderliggende objecten worden geherbruikt dus geen probleem
    );

    const gekozenOperator$: rx.Observable<FilterEditor.BinaryComparisonOperator> = forControlValue(
      this.operatorControl
    ).pipe(filter(isNotNullObject));

    const gekozenHoofdLetterGevoelig$: rx.Observable<boolean> = forControlValue(
      this.hoofdLetterGevoeligControl
    );

    const gekozenText$: rx.Observable<option.Option<
      FilterEditor.LiteralValue
    >> = rx
      .merge(
        forControlValue(this.textWaardeControl),
        forControlValue(this.dropdownWaardeControl),
        forControlValue(this.autocompleteWaardeControl).pipe(
          map((input) => (isWrapped(input) ? extractValue(input) : input)) // Partiële invoer -> invalid input
        )
      )
      .pipe(
        distinctUntilChanged(), // in dit geval vgln we op strings, dus ook OK
        map((input) =>
          pipe(
            option.fromNullable(input),
            option.map((value) =>
              FilterEditor.LiteralValue("string")(
                sanitiseText(value.toString())
              )
            )
          )
        )
      );

    const gekozenDatum$ = forControlValue(this.datumWaardeControl).pipe(
      distinctUntilChanged((v1, v2) => {
        if (moment.isMoment(v1) && moment.isMoment(v2)) {
          return v1.isSame(v2);
        } else {
          return v1 === v2;
        }
      }),
      map((input) =>
        pipe(
          option.fromNullable(input),
          option.filter(moment.isMoment),
          option.map((m) => {
            // We hebben een probleem in de zin dat de date component verbergt wat de input is en enkel de geparste date
            // terug geeft. Daar komt dan nog bij dat de parsing niet strikt is (de setting die we daarvoor gebruiken
            // wordt blijkbaar genegeerd). Het gevolg is dat er bij manuele invoer datums gegenereerd worden die de
            // gebruiker helemaal niet ingegeven heeft. Wat we eigenlijk willen, is de letterlijke invoer capteren.
            //
            // Het toeval wil dat het object dat Moment terug geeft, wel de input bevat wanneer niet alle input verwerkt
            // is, maar dat is eigenlijk niet gedocumenteerd. Het alternatief is om ofwel met de parsingFlags te werken,
            // ofwel een MomentDateAdapter te gebruiken. Beiden zijn evenwel veel meer werk dan onderstaande hack.
            //
            const input = m["_i"]; // Dit is de hack.
            if (typeof input === "string") {
              // input niet volledig verwerkt
              return FilterEditor.LiteralValue("string")(input);
            } else {
              return FilterEditor.LiteralValue("date")(
                DateTime.fromJSDate(m.toDate())
              );
            }
          })
        )
      )
    );

    const gekozenInteger$: rx.Observable<option.Option<
      FilterEditor.LiteralValue
    >> = forControlValue(this.integerWaardeControl).pipe(
      distinctUntilChanged(), // in dit geval vgln we op getallen, dus ook OK
      map((input) =>
        pipe(
          parseInteger(input),
          option.map(FilterEditor.LiteralValue("integer"))
        )
      )
    );
    const gekozenDouble$: rx.Observable<option.Option<
      FilterEditor.LiteralValue
    >> = forControlValue(this.doubleWaardeControl).pipe(
      distinctUntilChanged(), // in dit geval vgln we op getallen, dus ook OK
      map((input) =>
        pipe(
          parseDouble(input),
          option.map(FilterEditor.LiteralValue("double"))
        )
      )
    );

    const range$: rx.Observable<option.Option<
      FilterEditor.LiteralValue
    >> = rx
      .combineLatest(
        forControlValue(this.rangeMagnitudeWaardeControl).pipe(
          distinctUntilChanged(),
          map(parseInteger)
        ),
        forControlValue(this.rangeUnitWaardeControl).pipe(
          distinctUntilChanged(),
          map(option.fromNullable),
          map(option.filter(isString)),
          map(option.filter(nonEmptyString))
        )
      )
      .pipe(
        map(([maybeMagnitude, maybeUnit]) =>
          pipe(
            apply.sequenceT(option.option)(maybeMagnitude, maybeUnit),
            option.map(([magnitude, unit]) =>
              Filter.Range.create(unit, magnitude)
            ),
            option.map(FilterEditor.LiteralValue("range"))
          )
        )
      );

    const gekozenWaarde$: rx.Observable<option.Option<
      FilterEditor.LiteralValue
    >> = rx.merge(
      gekozenText$,
      gekozenInteger$,
      gekozenDouble$,
      gekozenDatum$,
      range$
    );

    type ExpressionEditorUpdate = Endomorphism<FilterEditor.ExpressionEditor>;
    type TermEditorUpdate = Endomorphism<FilterEditor.TermEditor>;

    const zetNaam$: rx.Observable<ExpressionEditorUpdate> = gekozenNaam$.pipe(
      map(FilterEditor.setName)
    );
    const zetHoofdletterGevoelig$: rx.Observable<TermEditorUpdate> = gekozenHoofdLetterGevoelig$.pipe(
      map(FilterEditor.selectHoofdletterGevoelig)
    );
    const zetProperty$: rx.Observable<TermEditorUpdate> = gekozenProperty$.pipe(
      map(FilterEditor.selectedProperty)
    );
    const zetOperator$: rx.Observable<TermEditorUpdate> = gekozenOperator$.pipe(
      withLatestFrom(
        rx.merge(
          gekozenHoofdLetterGevoelig$,
          rx.of(false),
          this.newFilterEditor$.pipe(map(() => false))
        )
      ),
      map(([operator, caseSensitive]) =>
        FilterEditor.selectOperator(operator)(caseSensitive)
      )
    );
    const zetWaarde$: rx.Observable<TermEditorUpdate> = gekozenWaarde$.pipe(
      map(FilterEditor.selectValue)
    );

    const initExpressionEditor$: rx.Observable<FilterEditor.ExpressionEditor> = laag$.pipe(
      map(FilterEditor.fromToegevoegdeVectorLaag)
    );

    const termEditorUpdates$: rx.Observable<ExpressionEditorUpdate> = rx
      .merge(zetProperty$, zetOperator$, zetWaarde$, zetHoofdletterGevoelig$)
      .pipe(
        map((teu) => (ee: FilterEditor.ExpressionEditor) =>
          FilterEditor.update(teu(ee.current))(ee)
        )
      );

    const expressionEditorUpdates$ = rx.merge(
      zetNaam$,
      termEditorUpdates$,
      this.newFilterEditor$
    );

    this.filterEditor$ = initExpressionEditor$
      .pipe(
        switchMap((initExpressionEditor) =>
          expressionEditorUpdates$.pipe(
            scan(
              (
                expEd: FilterEditor.ExpressionEditor,
                update: Endomorphism<FilterEditor.ExpressionEditor>
              ) => update(expEd),
              initExpressionEditor
            ),
            startWith(initExpressionEditor),
            tap(() => this.cdr.detectChanges())
          )
        )
      )
      .pipe(shareReplay(1));

    this.kanHuidigeEditorVerwijderen$ = this.filterEditor$.pipe(
      map((editor) => FilterEditor.canRemoveCurrent(editor))
    );

    this.veldwaardeType$ = this.filterEditor$.pipe(
      map((editor) =>
        FilterEditor.matchTermEditor({
          Field: () => FilterEditor.freeStringInputValueSelector, // we zouden er kunnen voor kiezen om inputveld voorlopig niet te tonen
          Operator: (termEditor) => termEditor.valueSelector,
          Value: (termEditor) => termEditor.valueSelector,
          Completed: (termEditor) => termEditor.valueSelector,
          CompletedWithValue: (termEditor) => termEditor.valueSelector,
        })(editor.current)
      )
    );

    const changedFilterEditor$ = this.filterEditor$.pipe(
      distinctUntilChanged((fed1, fed2) =>
        FilterEditor.setoidTermEditor.equals(fed1.current, fed2.current)
      )
    );

    // Deze subscribe zorgt er voor dat de updates effectief uitgevoerd worden
    this.bindToLifeCycle(
      rx.combineLatest([
        changedFilterEditor$,
        kaart.modelChanges.laagfilteraanpassingState$.pipe(
          map(isAanpassingBezig)
        ),
      ])
    ).subscribe(([expressionEditor, zichtbaar]) => {
      if (zichtbaar) {
        // zet control waarden bij aanpassen van expressionEditor
        option.fold(
          () => this.naamControl.reset("", { emitEvent: false }),
          (name) => this.naamControl.setValue(name, { emitEvent: false })
        )(expressionEditor.name);
        FilterEditor.matchTermEditor({
          Field: () => {
            disableEnabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.datumWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl,
              this.rangeMagnitudeWaardeControl,
              this.rangeUnitWaardeControl
            );
            resetWithoutEvent(
              this.veldControl,
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.datumWaardeControl,
              this.autocompleteWaardeControl,
              this.rangeMagnitudeWaardeControl,
              this.rangeUnitWaardeControl
            );
            this.hoofdLetterGevoeligControl.reset(false, { emitEvent: false });
          },
          Operator: (opr) => {
            enableDisabled(this.operatorControl);
            disableEnabled(
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.datumWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl,
              this.rangeMagnitudeWaardeControl,
              this.rangeUnitWaardeControl
            );
            this.veldControl.setValue(opr.selectedProperty, {
              emitEvent: false,
            });
            resetWithoutEvent(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.datumWaardeControl,
              this.autocompleteWaardeControl,
              this.rangeMagnitudeWaardeControl,
              this.rangeUnitWaardeControl
            );
            this.hoofdLetterGevoeligControl.reset(false, { emitEvent: false });
            this.operatorControl.setValue(null);
          },
          Value: (val) => {
            enableDisabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.datumWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl,
              this.rangeMagnitudeWaardeControl,
              this.rangeUnitWaardeControl
            );
            this.veldControl.setValue(val.selectedProperty, {
              emitEvent: false,
            });
            this.operatorControl.setValue(val.selectedOperator, {
              emitEvent: false,
            });
            this.hoofdLetterGevoeligControl.setValue(val.caseSensitive, {
              emitEvent: false,
            });
            // We mogen enkel de getoonde control resetten, want anders krijgen we een event en daaropvolgende update
            // voor de andere controls
            FilterEditor.matchValueSelector({
              empty: () => {},
              free: (valueSelector) => {
                switch (valueSelector.valueType) {
                  case "string":
                    this.textWaardeControl.reset("", { emitEvent: true });
                    break;
                  case "double":
                    this.doubleWaardeControl.reset(0.0, { emitEvent: true });
                    break;
                  case "integer":
                    this.integerWaardeControl.reset(0, { emitEvent: true });
                    break;
                }
              },
              selection: () => {
                this.autocompleteWaardeControl.reset(
                  option.fold(
                    () => "",
                    (sv: fed.SelectedValue) => sv.value
                  )(val.workingValue),
                  { emitEvent: true }
                );
                this.dropdownWaardeControl.reset(
                  option.fold(
                    () => "",
                    (sv: fed.SelectedValue) => sv.value
                  )(val.workingValue),
                  { emitEvent: true }
                );
              },
              date: () => {
                this.datumWaardeControl.reset(
                  option.fold(
                    () => "",
                    (sv: fed.SelectedValue) => sv.value
                  )(val.workingValue),
                  { emitEvent: true }
                );
              },
              range: () => {
                this.rangeUnitWaardeControl.reset(
                  option.fold(
                    () => "",
                    (sv: fed.SelectedValue) => (sv.value as Filter.Range).unit
                  )(val.workingValue),
                  { emitEvent: true }
                );
                this.rangeMagnitudeWaardeControl.reset(1, { emitEvent: true });
              },
            })(val.valueSelector);
          },
          Completed: (compl) => {
            enableDisabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.datumWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl,
              this.rangeMagnitudeWaardeControl,
              this.rangeUnitWaardeControl
            );
            this.veldControl.setValue(compl.selectedProperty, {
              emitEvent: false,
            });
            this.operatorControl.setValue(compl.selectedOperator, {
              emitEvent: false,
            });
          },
          CompletedWithValue: (compl) => {
            enableDisabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.datumWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl
            );
            this.veldControl.setValue(compl.selectedProperty, {
              emitEvent: false,
            });
            this.operatorControl.setValue(compl.selectedOperator, {
              emitEvent: false,
            });
            this.hoofdLetterGevoeligControl.setValue(compl.caseSensitive, {
              emitEvent: false,
            });
            FilterEditor.matchValueSelector({
              empty: () => {},
              free: (valueSelector) => {
                switch (valueSelector.valueType) {
                  case "string":
                    this.textWaardeControl.reset(compl.selectedValue.value, {
                      emitEvent: true,
                    });
                    break;
                  case "double":
                    this.doubleWaardeControl.reset(compl.selectedValue.value, {
                      emitEvent: true,
                    });
                    break;
                  case "integer":
                    this.integerWaardeControl.reset(compl.selectedValue.value, {
                      emitEvent: true,
                    });
                    break;
                }
              },
              selection: () => {
                this.dropdownWaardeControl.reset(compl.selectedValue.value, {
                  emitEvent: true,
                });
                this.autocompleteWaardeControl.reset(
                  compl.selectedValue.value,
                  { emitEvent: true }
                );
              },
              date: () => {
                // Wanneer we in de toestand completed zijn, dan weten we dat het type DateTime (van Luxon) is. De
                // datepicker verwacht echter een moment date.
                this.datumWaardeControl.reset(
                  moment((compl.selectedValue.value as DateTime).toJSDate()),
                  { emitEvent: true }
                );
              },
              range: () => {
                const range = compl.selectedValue.value as Filter.Range;
                this.rangeMagnitudeWaardeControl.reset(range.magnitude, {
                  emitEvent: true,
                });
                this.rangeUnitWaardeControl.reset(range.unit, {
                  emitEvent: true,
                });
              },
            })(compl.valueSelector);
          },
        })(expressionEditor.current);
      }
    });

    const operatorSelection$ = this.filterEditor$.pipe(
      map((fe) => fe.current),
      filter(FilterEditor.isAtLeastOperatorSelection)
    );

    this.properties$ = this.filterEditor$.pipe(
      map((editor) => editor.current.properties)
    );

    this.filteredVelden$ = rx
      .combineLatest([this.properties$, veldinfos$])
      .pipe(
        switchMap(([properties, veldinfos]) =>
          this.veldControl.valueChanges.pipe(
            filter(isNotNull),
            startWith<Filter.Property | string>(""), // nog niets ingetypt
            map((waarde) =>
              typeof waarde === "string"
                ? waarde
                : pipe(
                    option.fromNullable(waarde.label),
                    option.getOrElse(() => "")
                  )
            ),
            map((getypt) =>
              properties.filter((veld) =>
                pipe(
                  option.fromNullable(veld.label),
                  option.getOrElse(() => "")
                )
                  .toLowerCase()
                  .startsWith(getypt.toLowerCase())
              )
            ),
            map((properties) =>
              array.sort(ordPropertyByBaseField(veldinfos))(properties)
            )
          )
        ),
        shareReplay(1)
      );

    this.operators$ = operatorSelection$.pipe(
      map((os) => os.operatorSelectors)
    );

    const distinctValues$: rx.Observable<string[]> = this.filterEditor$.pipe(
      map((fe) => fe.current),
      filter(FilterEditor.isAtLeastValueSelection),
      map((vs) => vs.valueSelector),
      filter(
        isOfKind<
          string,
          FilterEditor.ValueSelector,
          FilterEditor.SelectionValueSelector,
          "selection"
        >("selection")
      ),
      map((selection) => selection.values)
    );

    this.filteredWaarden$ = rx
      .combineLatest([
        this.autocompleteWaardeControl.valueChanges.pipe(
          map((input) => (isWrapped(input) ? input.value : input)),
          startWith("")
        ),
        distinctValues$,
      ])
      .pipe(
        map(([typed, values]) =>
          pipe(
            array.filter((value: string) =>
              value.toLowerCase().startsWith(typed.toLowerCase())
            )(values),
            array.map((value: string) => Wrapped(value))
          )
        )
      );

    const inputFocus$ = this.actionDataFor$(
      "inputFocus",
      (uc): uc is InputFocus => true
    );

    this.checkboxState$ = rx
      .combineLatest([this.veldwaardeType$, inputFocus$])
      .pipe(
        mergeMap(([valueSelector, focus]) => {
          switch (focus) {
            case "eigenschap":
              // focus op eigenschap: altijd checkbox voor keyboard te activeren
              return rx.of<CheckboxState>("activateKeyboard");
            case "waarde":
            case "operator":
              // focus op waarde of operator: afhankelijk van veldwaardetype
              if (valueSelector.kind === "selection") {
                // meerkeuze -> activeer keyboard
                return rx.of<CheckboxState>("activateKeyboard");
              } else if (
                valueSelector.kind === "free" &&
                valueSelector.valueType === "string"
              ) {
                // vrije input -> hoofdelettergevoeligheid
                return rx.of<CheckboxState>("caseSensitive");
              } else {
                // overige -> toon geen checkbox
                return rx.of<CheckboxState>("none");
              }
            case "plainTextWaarde":
              // focus op vrije input -> hoofdelettergevoeligheid
              return rx.of<CheckboxState>("caseSensitive");
            default:
              return rx.EMPTY;
          }
        }),
        distinctUntilChanged()
      );

    // bij een nieuwe editor -> telkens autocomplete af
    this.bindToLifeCycle(this.newFilterEditor$).subscribe(() => {
      this.disableAutoComplete();
    });

    // naar welke autocomplete moeten we focussen?
    this.actieveAutoComplete$ = rx.merge(
      // bij een nieuwe filter editor focussen we op eigenschap
      this.newFilterEditor$.pipe(map(() => <ActieveAutoComplete>"eigenschap")),
      inputFocus$.pipe(
        mergeMap((value) => {
          switch (value) {
            case "eigenschap":
              // na focus op eigenschap -> focus op eigenschap
              return rx.of<ActieveAutoComplete>("eigenschap");
            case "waarde":
            case "plainTextWaarde":
            case "operator":
              // na focus op waarde, plainTextWaarde of operator -> focus op waarde
              return rx.of<ActieveAutoComplete>("waarde");
            default:
              return rx.EMPTY;
          }
        })
      )
    );

    // handle clicks on forceAutoComplete checkbox
    this.bindToLifeCycle(
      this.actionFor$("forceAutoComplete").pipe(
        withLatestFrom(this.actieveAutoComplete$)
      )
    ).subscribe(([, actieveAutoComplete]) => {
      this.forceAutoCompleteControl.setValue(
        !this.forceAutoCompleteControl.value
      );
      // als de autocomplete getoond moet worden, zet focus op input element, selecteer alle tekst
      // en verberg keuzeopties (deze worden over het input veld getoond)
      if (this.forceAutoCompleteControl.value) {
        const c = this;
        asap(() => {
          if (actieveAutoComplete === "waarde") {
            if (c.waardeAutocompleteInput) {
              c.waardeAutocompleteInput.focus();
              c.waardeAutocompleteInput.select();
            }
            if (c.waardeAutocompleteTrigger) {
              c.waardeAutocompleteTrigger.closePanel();
            }
          } else {
            if (c.eigenschapAutocompleteInput) {
              c.eigenschapAutocompleteInput.focus();
              c.eigenschapAutocompleteInput.select();
            }
            if (c.eigenschapAutocompleteTrigger) {
              c.eigenschapAutocompleteTrigger.closePanel();
            }
          }
        });
      }
      return false;
    });

    const maybeZetFilterCmd$ = forEveryLaag((laag) =>
      this.filterEditor$.pipe(
        map(FilterEditor.toExpressionFilter),
        map((maybeExpFilter) =>
          option.map((expFilter: Filter.ExpressionFilter) =>
            prt.ZetFilter(laag.titel, expFilter, kaartLogOnlyWrapper)
          )(maybeExpFilter)
        ),
        share()
      )
    );

    const geldigFilterCmd$ = maybeZetFilterCmd$.pipe(catOptions);
    this.ongeldigeFilter$ = maybeZetFilterCmd$.pipe(
      map((cmd) => option.isNone(cmd))
    );

    const laagNietZichtbaar$ = laag$.pipe(
      switchMap((laag) =>
        kaart.modelChanges.viewinstellingen$.pipe(
          map(
            (zi) => zi.zoom < laag.bron.minZoom || zi.zoom > laag.bron.maxZoom
          ),
          take(1)
        )
      )
    );

    const pasToeGeklikt$ = this.actionFor$("pasFilterToe");
    this.bindToLifeCycle(
      rx
        .combineLatest([laagNietZichtbaar$, geldigFilterCmd$])
        .pipe(sample(pasToeGeklikt$))
    ).subscribe(([laagNietZichtbaar, command]) => {
      this.dispatch(
        prt.MaakLaagZichtbaarCmd(command.titel, kaartLogOnlyWrapper)
      );
      this.dispatch(prt.StopVectorFilterBewerkingCmd());
      if (laagNietZichtbaar) {
        this.dispatch(
          prt.ToonMeldingCmd([
            `De laag '${command.titel}' is niet zichtbaar op kaart op dit zoomniveau, gelieve verder in te zoomen`,
          ])
        );
      }
      this.dispatch(command);
    });
  }

  disableAutoComplete() {
    this.forceAutoCompleteControl.setValue(false);
  }

  verwijderActieveEditor() {
    this.newFilterEditor$.next(FilterEditor.remove);
  }

  onExpressionEditorUpdate(
    newExpressionEditor: Endomorphism<FilterEditor.ExpressionEditor>
  ) {
    this.newFilterEditor$.next(newExpressionEditor);
  }

  close() {
    this.dispatch(prt.StopVectorFilterBewerkingCmd());
  }

  displayVeld(veld?: Filter.Property): string | undefined {
    return veld ? veld.label : undefined;
  }

  errorVeld() {
    return this.veldControl.hasError("required")
      ? "Gelieve een eigenschap te kiezen"
      : "";
  }

  errorOperator(): string {
    return this.operatorControl.hasError("required")
      ? "Gelieve een operator te kiezen"
      : "";
  }

  errorTextWaarde(): string {
    return this.textWaardeControl.hasError("required")
      ? "Gelieve een waarde in te geven"
      : "";
  }

  errorIntegerWaarde(): string {
    return this.integerWaardeControl.hasError("required")
      ? "Gelieve een geheel getal in te geven"
      : "";
  }

  errorDoubleWaarde(): string {
    return this.doubleWaardeControl.hasError("required")
      ? "Gelieve een getal in te geven"
      : "";
  }

  errorDateWaarde(): string {
    return this.datumWaardeControl.hasError("required")
      ? "Gelieve een datum in te geven"
      : "";
  }

  displayAutocompleteWaarde(waarde?: Wrapped | string): string | undefined {
    return typeof waarde === "object" ? waarde.value : waarde;
  }

  errorAutocompleteWaarde(): string {
    return this.autocompleteWaardeControl.hasError("required")
      ? "Gelieve een waarde in te geven"
      : "";
  }

  onClickOutside() {
    if (!this.clickInsideDialog) {
      this.close();
    }
    this.clickInsideDialog = false;
    return false;
  }

  onClickInside() {
    this.clickInsideDialog = true;
    return false;
  }

  // Dit is nodig om de event op te vangen vóór dat de dialog zelf het doet
  onClickHoofdLetterGevoelig() {
    if (this.hoofdLetterGevoeligControl.enabled) {
      this.hoofdLetterGevoeligControl.setValue(
        !this.hoofdLetterGevoeligControl.value
      );
    }
    return false;
  }
}
