import { ChangeDetectorRef, Component, NgZone } from "@angular/core";
import { FormControl, ValidationErrors, Validators } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { Endomorphism, Function1, Refinement } from "fp-ts/lib/function";
import * as option from "fp-ts/lib/Option";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { Ord } from "fp-ts/lib/Ord";
import * as ord from "fp-ts/lib/Ord";
import * as rx from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  sample,
  scan,
  share,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
  withLatestFrom
} from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { isNotNull, isNotNullObject } from "../util/function";
import { isOfKind } from "../util/kinded";
import { parseDouble, parseInteger } from "../util/number";
import { catOptions, forEvery } from "../util/operators";

import { FilterAanpassingBezig, isAanpassingBezig } from "./filter-aanpassing-state";
import { FilterEditor as fed } from "./filter-builder";
import { Filter as fltr } from "./filter-model";

const autoCompleteSelectieVerplichtValidator: Function1<FormControl, ValidationErrors | null> = control => {
  if (typeof control.value === "string") {
    return { required: {} };
  }
  return null;
};

const ordPropertyByBaseField: Function1<Map<string, ke.VeldInfo>, Ord<fltr.Property>> = veldinfos =>
  ord.contramap(prop => ke.VeldInfo.veldInfoOpNaam(prop.ref, veldinfos), option.getOrd(ord.getDualOrd(ke.VeldInfo.ordVeldOpBasisVeld)));

const enableDisabled = (...controls: FormControl[]): void => {
  controls.forEach(control => {
    if (control.disabled) {
      control.enable({ emitEvent: false });
    }
  });
};

const disableEnabled = (...controls: FormControl[]): void => {
  controls.forEach(control => {
    if (control.enabled) {
      control.disable({ emitEvent: false });
    }
  });
};

const resetWithoutEvent = (...controls: FormControl[]): void => {
  controls.forEach(control => control.reset("", { emitEvent: false }));
};

const sanitiseText: Endomorphism<string> = text => text.trim().replace(/[\x00-\x1F]/g, "");

// We willen fragmenten van waarden scheiden van volledige waarden. Dat doen we liefst zonder steeds te controleren tov
// de volledige lijst van waarden. Die lijst is immers niet eenvoudig voorhanden. De manier die hier gebruiken is om
// waarden in een object te wrappen om zo het verschil met een string te detecteren.
interface Wrapped {
  readonly value: string;
}
const Wrapped: Function1<string, Wrapped> = value => ({ value });
const isWrapped: Refinement<any, Wrapped> = (obj): obj is Wrapped => obj && obj.value && typeof obj.value === "string";
const extractValue: Function1<Wrapped, string> = wrapped => wrapped.value;

@Component({
  selector: "awv-filter-editor",
  templateUrl: "./filter-editor.component.html",
  styleUrls: ["./filter-editor.component.scss"]
})
export class FilterEditorComponent extends KaartChildComponentBase {
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;

  readonly filteredVelden$: rx.Observable<fltr.Property[]>;
  readonly operators$: rx.Observable<fed.ComparisonOperator[]>;
  readonly filteredWaarden$: rx.Observable<Wrapped[]>;

  readonly naamControl = new FormControl("");
  readonly veldControl = new FormControl("", [Validators.required, autoCompleteSelectieVerplichtValidator]);
  // Als we het oude gedrag weer willen waar de operator direct op '=' staat, dan moeten we de selectedOperator
  // doorschuiven naar FieldSelection
  readonly operatorControl = new FormControl(null, [Validators.required, autoCompleteSelectieVerplichtValidator]);
  readonly textWaardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);
  readonly integerWaardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);
  readonly doubleWaardeControl = new FormControl({ value: null });

  readonly hoofdLetterGevoeligControl = new FormControl({ value: null, disabled: true });

  readonly dropdownWaardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);
  readonly autocompleteWaardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);

  readonly ongeldigeFilter$: rx.Observable<boolean>;

  readonly filterEditor$: rx.Observable<fed.ExpressionEditor>;

  readonly veldwaardeType$: rx.Observable<fed.ValueSelector>;

  readonly kanHuidigeEditorVerwijderen$: rx.Observable<boolean>;

  readonly newFilterEditor$ = new rx.Subject<Endomorphism<fed.ExpressionEditor>>();

  private clickInsideDialog = false;

  readonly operatorCompare: (o1: fed.ComparisonOperator, o2: fed.ComparisonOperator) => boolean = (o1, o2) => o1.operator === o2.operator;

  constructor(kaart: KaartComponent, zone: NgZone, private readonly cdr: ChangeDetectorRef) {
    super(kaart, zone);

    this.zichtbaar$ = kaart.modelChanges.laagfilteraanpassingState$.pipe(map(isAanpassingBezig));

    const aanpassing$: rx.Observable<FilterAanpassingBezig> = kaart.modelChanges.laagfilteraanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
    );

    const laag$: rx.Observable<ke.ToegevoegdeVectorLaag> = aanpassing$.pipe(
      map(aanpassing => aanpassing.laag), // Neemt de laag op het moment dat de gebruiker de aanpassing vroeg. Ok in dit geval.
      shareReplay(1)
    );

    const veldinfos$ = laag$.pipe(
      map(ke.ToegevoegdeVectorLaag.veldInfosMapLens.get),
      share()
    );

    this.titel$ = laag$.pipe(map(laag => laag.titel));

    const forEveryLaag = forEvery(laag$);

    const forControlValue: Function1<FormControl, rx.Observable<any>> = formcontrol =>
      forEveryLaag(() =>
        formcontrol.valueChanges.pipe(
          filter(() => formcontrol.enabled),
          share()
        )
      );

    laag$.subscribe(() => {
      this.naamControl.reset("", { emitEvent: false });
      this.veldControl.reset("", { emitEvent: false });
      this.operatorControl.reset(null, { emitEvent: false });
      this.textWaardeControl.reset("", { emitEvent: false });
      this.integerWaardeControl.reset(0, { emitEvent: false });
      this.doubleWaardeControl.reset(0, { emitEvent: false });
      this.dropdownWaardeControl.reset("", { emitEvent: false });
      this.autocompleteWaardeControl.reset("", { emitEvent: false });
      this.hoofdLetterGevoeligControl.reset(null, { emitEvent: false });
    });

    const gekozenNaam$: rx.Observable<Option<string>> = forControlValue(this.naamControl)
      .pipe(
        debounceTime(100), // voor de snelle typers
        distinctUntilChanged(),
        map(x => fromNullable(x).filter(x => x !== ""))
      )
      .pipe(share());

    const gekozenProperty$: rx.Observable<fltr.Property> = forControlValue(this.veldControl).pipe(
      filter(isNotNullObject),
      distinctUntilChanged() // gebruikt object identity, maar de onderliggende objecten worden geherbruikt dus geen probleem
    );

    const gekozenOperator$: rx.Observable<fed.BinaryComparisonOperator> = forControlValue(this.operatorControl).pipe(
      filter(isNotNullObject)
    );

    const gekozenHoofdLetterGevoelig$: rx.Observable<boolean> = forControlValue(this.hoofdLetterGevoeligControl);

    const gekozenText$: rx.Observable<Option<fed.LiteralValue>> = rx
      .merge(
        forControlValue(this.textWaardeControl),
        forControlValue(this.dropdownWaardeControl),
        forControlValue(this.autocompleteWaardeControl).pipe(
          map(input => (isWrapped(input) ? extractValue(input) : input)) // Partiële invoer -> invalid input
        )
      )
      .pipe(
        distinctUntilChanged(), // in dit geval vgln we op strings, dus ook OK
        map(input => fromNullable(input).map(value => fed.LiteralValue(sanitiseText(value.toString()), "string")))
      );
    const gekozenInteger$: rx.Observable<Option<fed.LiteralValue>> = forControlValue(this.integerWaardeControl).pipe(
      distinctUntilChanged(), // in dit geval vgln we op getallen, dus ook OK
      map(input => parseInteger(input).map(num => fed.LiteralValue(num, "integer")))
    );
    const gekozenDouble$: rx.Observable<Option<fed.LiteralValue>> = forControlValue(this.doubleWaardeControl).pipe(
      distinctUntilChanged(), // in dit geval vgln we op getallen, dus ook OK
      map(input => parseDouble(input).map(value => fed.LiteralValue(value, "double")))
    );
    const gekozenWaarde$: rx.Observable<Option<fed.LiteralValue>> = rx.merge(gekozenText$, gekozenInteger$, gekozenDouble$);

    type ExpressionEditorUpdate = Endomorphism<fed.ExpressionEditor>;
    type TermEditorUpdate = Endomorphism<fed.TermEditor>;

    const zetNaam$: rx.Observable<ExpressionEditorUpdate> = gekozenNaam$.pipe(map(fed.setName));
    const zetHoofdletterGevoelig$: rx.Observable<TermEditorUpdate> = gekozenHoofdLetterGevoelig$.pipe(map(fed.selectHoofdletterGevoelig));
    const zetProperty$: rx.Observable<TermEditorUpdate> = gekozenProperty$.pipe(map(fed.selectedProperty));
    const zetOperator$: rx.Observable<TermEditorUpdate> = gekozenOperator$.pipe(
      withLatestFrom(rx.merge(gekozenHoofdLetterGevoelig$, rx.of(false))),
      map(([operator, caseSensitive]) => fed.selectOperator(operator)(caseSensitive))
    );
    const zetWaarde$: rx.Observable<TermEditorUpdate> = gekozenWaarde$.pipe(map(fed.selectValue));

    const initExpressionEditor$: rx.Observable<fed.ExpressionEditor> = laag$.pipe(map(fed.fromToegevoegdeVectorLaag));

    const termEditorUpdates$: rx.Observable<ExpressionEditorUpdate> = rx
      .merge(zetProperty$, zetOperator$, zetWaarde$, zetHoofdletterGevoelig$)
      .pipe(map(teu => (ee: fed.ExpressionEditor) => fed.update(teu(ee.current))(ee)));

    const expressionEditorUpdates$ = rx.merge(zetNaam$, termEditorUpdates$, this.newFilterEditor$.asObservable());

    this.filterEditor$ = initExpressionEditor$
      .pipe(
        switchMap(initExpressionEditor =>
          expressionEditorUpdates$.pipe(
            scan((expEd: fed.ExpressionEditor, update: Endomorphism<fed.ExpressionEditor>) => update(expEd), initExpressionEditor),
            startWith(initExpressionEditor),
            tap(() => this.cdr.detectChanges())
          )
        )
      )
      .pipe(shareReplay(1));

    this.kanHuidigeEditorVerwijderen$ = this.filterEditor$.pipe(map(editor => fed.canRemoveCurrent(editor)));

    this.veldwaardeType$ = this.filterEditor$.pipe(
      map(editor =>
        fed.matchTermEditor({
          Field: () => fed.freeStringInputValueSelector, // we zouden er kunnen voor kiezen om het inputveld voorlopig niet te tonen
          Operator: termEditor => termEditor.valueSelector,
          Value: termEditor => termEditor.valueSelector,
          Completed: termEditor => termEditor.valueSelector,
          CompletedWithValue: termEditor => termEditor.valueSelector
        })(editor.current)
      )
    );

    const changedFilterEditor$ = this.filterEditor$.pipe(
      distinctUntilChanged((fed1, fed2) => fed.setoidTermEditor.equals(fed1.current, fed2.current))
    );

    // Deze subscribe zorgt er voor dat de updates effectief uitgevoerd worden
    this.bindToLifeCycle(
      rx.combineLatest([changedFilterEditor$, kaart.modelChanges.laagfilteraanpassingState$.pipe(map(isAanpassingBezig))])
    ).subscribe(([expressionEditor, zichtbaar]) => {
      if (zichtbaar) {
        // zet control waarden bij aanpassen van expressionEditor
        expressionEditor.name.foldL(
          () => this.naamControl.reset("", { emitEvent: false }),
          name => this.naamControl.setValue(name, { emitEvent: false })
        );
        fed.matchTermEditor({
          Field: () => {
            disableEnabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl
            );
            resetWithoutEvent(
              this.veldControl,
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.autocompleteWaardeControl
            );
            this.hoofdLetterGevoeligControl.reset(false, { emitEvent: false });
          },
          Operator: opr => {
            enableDisabled(this.operatorControl);
            disableEnabled(
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl
            );
            this.veldControl.setValue(opr.selectedProperty, { emitEvent: false });
            resetWithoutEvent(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.autocompleteWaardeControl
            );
            this.hoofdLetterGevoeligControl.reset(false, { emitEvent: false });
            this.operatorControl.setValue(null);
          },
          Value: val => {
            enableDisabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl
            );
            this.veldControl.setValue(val.selectedProperty, { emitEvent: false });
            this.operatorControl.setValue(val.selectedOperator, { emitEvent: false });
            this.hoofdLetterGevoeligControl.setValue(val.caseSensitive, { emitEvent: false });
            // We mogen enkel de getoonde control resetten, want anders krijgen we een event en daaropvolgende update
            // voor de andere controls
            fed.matchValueSelector({
              empty: () => {},
              free: valueSelector => {
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
              selection: valueSelector => {
                switch (valueSelector.selectionType) {
                  case "autocomplete":
                    this.autocompleteWaardeControl.setValue(val.workingValue.fold("", sv => sv.value), { emitEvent: true });
                    break;
                  case "dropdown":
                    this.dropdownWaardeControl.reset("", { emitEvent: true });
                }
              }
            })(val.valueSelector);
          },
          Completed: compl => {
            enableDisabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl
            );
            this.veldControl.setValue(compl.selectedProperty, { emitEvent: false });
            this.operatorControl.setValue(compl.selectedOperator, { emitEvent: false });
          },
          CompletedWithValue: compl => {
            enableDisabled(
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl,
              this.dropdownWaardeControl,
              this.autocompleteWaardeControl,
              this.hoofdLetterGevoeligControl
            );
            this.veldControl.setValue(compl.selectedProperty, { emitEvent: false });
            this.operatorControl.setValue(compl.selectedOperator, { emitEvent: false });
            this.hoofdLetterGevoeligControl.setValue(compl.caseSensitive, { emitEvent: false });
            fed.matchValueSelector({
              empty: () => {},
              free: valueSelector => {
                switch (valueSelector.valueType) {
                  case "string":
                    this.textWaardeControl.reset(compl.selectedValue.value, { emitEvent: true });
                    break;
                  case "double":
                    this.doubleWaardeControl.reset(compl.selectedValue.value, { emitEvent: true });
                    break;
                  case "integer":
                    this.integerWaardeControl.reset(compl.selectedValue.value, { emitEvent: true });
                    break;
                }
              },
              selection: valueSelector => {
                switch (valueSelector.selectionType) {
                  case "autocomplete":
                    this.autocompleteWaardeControl.reset(Wrapped(compl.selectedValue.value as string), { emitEvent: true });
                    break;
                  case "dropdown":
                    this.dropdownWaardeControl.reset(Wrapped(compl.selectedValue.value as string), { emitEvent: true });
                }
              }
            })(compl.valueSelector);
          }
        })(expressionEditor.current);
      }
    });

    const operatorSelection$ = this.filterEditor$.pipe(
      map(fe => fe.current),
      filter(fed.isAtLeastOperatorSelection)
    );

    const properties$: rx.Observable<fltr.Property[]> = this.filterEditor$.pipe(map(editor => editor.current.properties));

    this.filteredVelden$ = rx.combineLatest([properties$, veldinfos$]).pipe(
      switchMap(([properties, veldinfos]) =>
        this.veldControl.valueChanges.pipe(
          filter(isNotNull),
          startWith<fltr.Property | string>(""), // nog niets ingetypt
          map(waarde => (typeof waarde === "string" ? waarde : fromNullable(waarde.label).getOrElse(""))),
          map(getypt =>
            properties.filter(veld =>
              fromNullable(veld.label)
                .getOrElse("")
                .toLowerCase()
                .startsWith(getypt.toLowerCase())
            )
          ),
          map(properties => array.sort(ordPropertyByBaseField(veldinfos))(properties))
        )
      ),
      shareReplay(1)
    );

    this.operators$ = operatorSelection$.pipe(map(os => os.operatorSelectors));

    const distinctValues$: rx.Observable<string[]> = this.filterEditor$.pipe(
      map(fe => fe.current),
      filter(fed.isAtLeastValueSelection),
      map(vs => vs.valueSelector),
      filter(isOfKind<string, fed.ValueSelector, fed.SelectionValueSelector, "selection">("selection")),
      map(selection => selection.values)
    );

    this.filteredWaarden$ = rx
      .combineLatest([
        this.autocompleteWaardeControl.valueChanges.pipe(
          map(input => (isWrapped(input) ? input.value : input)),
          startWith("")
        ),
        distinctValues$
      ])
      .pipe(
        map(([typed, values]) =>
          array.filter(values, value => value.toLowerCase().startsWith(typed.toLowerCase())).map(value => Wrapped(value))
        )
      );

    const maybeZetFilterCmd$ = forEveryLaag(laag =>
      this.filterEditor$.pipe(
        map(fed.toExpressionFilter),
        map(maybeExpFilter => maybeExpFilter.map(expFilter => prt.ZetFilter(laag.titel, expFilter, kaartLogOnlyWrapper))),
        share()
      )
    );

    const geldigFilterCmd$ = maybeZetFilterCmd$.pipe(catOptions);
    this.ongeldigeFilter$ = maybeZetFilterCmd$.pipe(map(cmd => cmd.isNone()));

    const laagNietZichtbaar$ = laag$.pipe(
      switchMap(laag =>
        kaart.modelChanges.viewinstellingen$.pipe(
          map(zi => zi.zoom < laag.bron.minZoom || zi.zoom > laag.bron.maxZoom),
          take(1)
        )
      )
    );

    const pasToeGeklikt$ = this.actionFor$("pasFilterToe");
    this.bindToLifeCycle(rx.combineLatest([laagNietZichtbaar$, geldigFilterCmd$]).pipe(sample(pasToeGeklikt$))).subscribe(
      ([laagNietZichtbaar, command]) => {
        this.dispatch(prt.MaakLaagZichtbaarCmd(command.titel, kaartLogOnlyWrapper));
        this.dispatch(prt.StopVectorFilterBewerkingCmd());
        if (laagNietZichtbaar) {
          this.dispatch(
            prt.MeldComponentFoutCmd([
              `De laag '${command.titel}' is niet zichtbaar op kaart op dit zoomniveau, gelieve verder in te zoomen`
            ])
          );
        }
        this.dispatch(command);
      }
    );
  }

  verwijderActieveEditor() {
    this.newFilterEditor$.next(fed.remove);
  }

  onExpressionEditorUpdate(newExpressionEditor: Endomorphism<fed.ExpressionEditor>) {
    this.newFilterEditor$.next(newExpressionEditor);
  }

  close() {
    this.dispatch(prt.StopVectorFilterBewerkingCmd());
  }

  displayVeld(veld?: fltr.Property): string | undefined {
    return veld ? veld.label : undefined;
  }

  errorVeld() {
    return this.veldControl.hasError("required") ? "Gelieve een eigenschap te kiezen" : "";
  }

  errorOperator(): string {
    return this.operatorControl.hasError("required") ? "Gelieve een operator te kiezen" : "";
  }

  errorTextWaarde(): string {
    return this.textWaardeControl.hasError("required") ? "Gelieve een waarde in te geven" : "";
  }

  errorIntegerWaarde(): string {
    return this.integerWaardeControl.hasError("required") ? "Gelieve een waarde in te geven" : "";
  }

  errorDoubleWaarde(): string {
    return this.doubleWaardeControl.hasError("required") ? "Gelieve een waarde in te geven" : "";
  }

  displayAutocompleteWaarde(waarde?: Wrapped | string): string | undefined {
    return typeof waarde === "object" ? waarde.value : waarde;
  }

  errorAutocompleteWaarde(): string {
    return this.autocompleteWaardeControl.hasError("required") ? "Gelieve een waarde in te geven" : "";
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
  onClickCheckbox() {
    this.hoofdLetterGevoeligControl.setValue(!this.hoofdLetterGevoeligControl.value);
    return false;
  }
}
