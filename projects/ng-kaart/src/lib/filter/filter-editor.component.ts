import { ChangeDetectorRef, Component, NgZone } from "@angular/core";
import { FormControl, ValidationErrors, Validators } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { Endomorphism, Function1, Function2 } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as option from "fp-ts/lib/Option";
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
  tap
} from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { kaartLogger } from "../kaart/log";
import { Consumer1, isNotNull, isNotNullObject } from "../util/function";
import { parseDouble, parseInteger } from "../util/number";
import { catOptions, collectOption, forEvery, subSpy } from "../util/operators";

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

function enableDisabled(...controls: FormControl[]) {
  controls.forEach(control => {
    if (control.disabled) {
      control.enable({ emitEvent: false });
    }
  });
}

function disableEnabled(...controls: FormControl[]) {
  controls.forEach(control => {
    if (control.enabled) {
      control.disable({ emitEvent: false });
    }
  });
}

function resetWithEvent(...controls: FormControl[]): void {
  controls.forEach(control => control.reset(""));
}

function resetWithoutEvent(...controls: FormControl[]): void {
  controls.forEach(control => control.reset("", { emitEvent: false }));
}

@Component({
  selector: "awv-filter-editor",
  templateUrl: "./filter-editor.component.html",
  styleUrls: ["./filter-editor.component.scss"]
})
export class FilterEditorComponent extends KaartChildComponentBase {
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;

  readonly filteredVelden$: rx.Observable<fltr.Property[]>;
  readonly filteredOperatoren$: rx.Observable<fed.BinaryComparisonOperator[]>;

  readonly naamControl = new FormControl("");
  readonly veldControl = new FormControl("", [Validators.required, autoCompleteSelectieVerplichtValidator]);
  // Als we het oude gedrag weer willen waar de operator direct op '=' staat, dan moeten we de selectedOperator
  // doorschuiven naar FieldSelection
  readonly operatorControl = new FormControl("", [Validators.required, autoCompleteSelectieVerplichtValidator]);
  readonly textWaardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);
  readonly integerWaardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);
  readonly doubleWaardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);

  readonly ongeldigeFilter$: rx.Observable<boolean>;

  readonly filterEditor$: rx.Observable<fed.ExpressionEditor>;

  readonly veldwaardeType$: rx.Observable<fed.ValueSelector>;

  readonly kanHuidigeEditorVerwijderen$: rx.Observable<boolean>;

  readonly newFilterEditor$ = new rx.Subject<Endomorphism<fed.ExpressionEditor>>();

  private clickInsideDialog = false;

  constructor(kaart: KaartComponent, zone: NgZone, private readonly cdr: ChangeDetectorRef) {
    super(kaart, zone);

    this.zichtbaar$ = kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig));

    const aanpassing$: rx.Observable<FilterAanpassingBezig> = kaart.modelChanges.laagFilterAanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
    );

    const laag$: rx.Observable<ke.ToegevoegdeVectorLaag> = subSpy("****laag")(
      aanpassing$.pipe(
        map(aanpassing => aanpassing.laag), // Neemt de laag op het moment dat de gebruiker de aanpassing vroeg. Ok in dit geval.
        shareReplay(1)
      )
    );

    const veldinfos$ = subSpy("****veldinfo$s")(
      laag$.pipe(
        map(ke.ToegevoegdeVectorLaag.veldInfosMapLens.get),
        share()
      )
    );

    this.titel$ = laag$.pipe(map(laag => laag.titel));

    const forEveryLaag = forEvery(laag$);

    const forControlValue: Function1<FormControl, rx.Observable<any>> = formcontrol =>
      forEveryLaag(() =>
        formcontrol.valueChanges.pipe(
          tap(value => {
            console.log("****raw value", formcontrol.value, value);
            if (!formcontrol.enabled) {
              console.log("****not enabled", formcontrol.value);
            }
          }),
          filter(() => formcontrol.enabled),
          share()
        )
      );

    laag$.subscribe(() => {
      this.naamControl.reset("", { emitEvent: false });
      this.veldControl.reset("", { emitEvent: false });
      this.operatorControl.reset("", { emitEvent: false });
      this.textWaardeControl.reset("", { emitEvent: false });
      this.integerWaardeControl.reset(0, { emitEvent: false });
      this.doubleWaardeControl.reset(0, { emitEvent: false });
    });

    const gekozenNaam$: rx.Observable<Option<string>> = subSpy("****gekozenNaam$")(
      forControlValue(this.naamControl).pipe(
        debounceTime(100), // voor de snelle typers
        distinctUntilChanged(),
        map(x => fromNullable(x).filter(x => x !== ""))
      )
    ).pipe(share());

    const gekozenProperty$: rx.Observable<fltr.Property> = subSpy("****gekozenProperty")(
      forControlValue(this.veldControl).pipe(
        filter(isNotNullObject),
        distinctUntilChanged() // gebruikt object identity, maar de onderliggende objecten worden geherbruikt dus geen probleem
      )
    );

    const gekozenOperator$: rx.Observable<fed.BinaryComparisonOperator> = forControlValue(this.operatorControl).pipe(
      filter(isNotNullObject),
      tap(o => console.log("*****Operator gekozen", o)),
      tap(o => console.log("*****Distinct operator gekozen", o))
    );
    const gekozenText$: rx.Observable<Option<fed.LiteralValue>> = subSpy("****gekozenText")(
      forControlValue(this.textWaardeControl).pipe(
        distinctUntilChanged(), // in dit geval vgln we op strings, dus ook OK
        map(input => fromNullable(input).map(value => fed.LiteralValue(value.toString(), "string")))
      )
    );
    const gekozenInteger$: rx.Observable<Option<fed.LiteralValue>> = subSpy("****gekozenInteger")(
      forControlValue(this.integerWaardeControl).pipe(
        distinctUntilChanged(), // in dit geval vgln we op getallen, dus ook OK
        map(input => parseInteger(input).map(num => fed.LiteralValue(num, "integer")))
      )
    );
    const gekozenDouble$: rx.Observable<Option<fed.LiteralValue>> = subSpy("****gekozenDouble")(
      forControlValue(this.doubleWaardeControl).pipe(
        distinctUntilChanged(), // in dit geval vgln we op getallen, dus ook OK
        map(input => parseDouble(input).map(value => fed.LiteralValue(value, "double")))
      )
    );
    const gekozenWaarde$: rx.Observable<Option<fed.LiteralValue>> = rx.merge(gekozenText$, gekozenInteger$, gekozenDouble$);

    type ExpressionEditorUpdate = Endomorphism<fed.ExpressionEditor>;
    type TermEditorUpdate = Endomorphism<fed.TermEditor>;

    const zetNaam$: rx.Observable<ExpressionEditorUpdate> = gekozenNaam$.pipe(map(fed.setName));
    const zetProperty$: rx.Observable<TermEditorUpdate> = gekozenProperty$.pipe(map(fed.selectedProperty));
    const zetOperator$: rx.Observable<TermEditorUpdate> = gekozenOperator$.pipe(map(fed.selectOperator));
    const zetWaarde$: rx.Observable<TermEditorUpdate> = gekozenWaarde$.pipe(
      tap(w => console.log("***waarde$", w)),
      map(fed.selectValue)
    );

    const initExpressionEditor$: rx.Observable<fed.ExpressionEditor> = subSpy("****initExpressionEditor$")(
      laag$.pipe(
        tap(l => console.log("****laag emits in initExpressionEditor$")),
        map(fed.fromToegevoegdeVectorLaag)
      )
    );

    const termEditorUpdates$: rx.Observable<ExpressionEditorUpdate> = subSpy("****termEditorUpdates$")(
      rx.merge(zetProperty$, zetOperator$, zetWaarde$).pipe(map(teu => (ee: fed.ExpressionEditor) => fed.update(teu(ee.current))(ee)))
    );

    const expressionEditorUpdates$ = rx.merge(zetNaam$, termEditorUpdates$, this.newFilterEditor$.asObservable());

    this.filterEditor$ = subSpy("****filterEditor$")(
      initExpressionEditor$.pipe(
        tap(() => console.log("****resetting filterEditor$ from initExpressionEditor$")),
        switchMap(initExpressionEditor =>
          expressionEditorUpdates$.pipe(
            scan((expEd: fed.ExpressionEditor, update: Endomorphism<fed.ExpressionEditor>) => update(expEd), initExpressionEditor),
            startWith(initExpressionEditor),
            tap(() => this.cdr.detectChanges()),
            tap(expressionEditor => kaartLogger.debug("****expressionEditor", expressionEditor))
          )
        )
      )
    ).pipe(shareReplay(1));

    this.kanHuidigeEditorVerwijderen$ = this.filterEditor$.pipe(map(editor => fed.canRemoveCurrent(editor)));

    this.veldwaardeType$ = this.filterEditor$.pipe(
      map(editor =>
        fed.matchTermEditor({
          Field: () => "FreeString" as "FreeString", // we zouder er kunnen voor kiezen om het inputveld voorlopig niet te tonen
          Operator: termEditor => termEditor.valueSelector,
          Value: termEditor => termEditor.valueSelector,
          Completed: termEditor => termEditor.valueSelector
        })(editor.current)
      )
    );

    const changedFilterEditor$ = this.filterEditor$.pipe(
      distinctUntilChanged((fed1, fed2) => fed.setoidTermEditor.equals(fed1.current, fed2.current))
    );

    // Deze subscribe zorgt er voor dat de updates effectief uitgevoerd worden
    this.bindToLifeCycle(
      rx.combineLatest(changedFilterEditor$, kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig)))
    ).subscribe(([expressionEditor, zichtbaar]) => {
      if (zichtbaar) {
        // zet control waarden bij aanpassen van expressionEditor
        expressionEditor.name.foldL(
          () => this.naamControl.reset("", { emitEvent: false }),
          name => this.naamControl.setValue(name, { emitEvent: false })
        );
        fed.matchTermEditor({
          Field: () => {
            console.log("****reset naar Field");
            disableEnabled(this.operatorControl, this.textWaardeControl, this.integerWaardeControl, this.doubleWaardeControl);
            resetWithoutEvent(
              this.veldControl,
              this.operatorControl,
              this.textWaardeControl,
              this.integerWaardeControl,
              this.doubleWaardeControl
            );
          },
          Operator: opr => {
            console.log("****reset naar Operator");
            enableDisabled(this.operatorControl);
            disableEnabled(this.textWaardeControl, this.integerWaardeControl, this.doubleWaardeControl);
            this.veldControl.setValue(opr.selectedProperty, { emitEvent: false });
            resetWithoutEvent(this.operatorControl, this.textWaardeControl, this.integerWaardeControl, this.doubleWaardeControl);
          },
          Value: val => {
            console.log("****reset naar Value");
            enableDisabled(this.operatorControl, this.textWaardeControl, this.integerWaardeControl, this.doubleWaardeControl);
            this.veldControl.setValue(val.selectedProperty, { emitEvent: false });
            this.operatorControl.setValue(val.selectedOperator, { emitEvent: false });
            // We mogen enkel de getoonde control resetten, want anders krijgen we een event en daaropvolgende update
            // voor de andere controls
            switch (val.valueSelector) {
              case "FreeString":
                this.textWaardeControl.reset("", { emitEvent: true });
                break;
              case "FreeDouble":
                this.doubleWaardeControl.reset(0.0, { emitEvent: true });
                break;
              case "FreeInteger":
                this.integerWaardeControl.reset(0, { emitEvent: true });
                break;
            }
          },
          Completed: compl => {
            console.log("****reset naar Completed");
            enableDisabled(this.operatorControl, this.textWaardeControl, this.integerWaardeControl, this.doubleWaardeControl);
            this.veldControl.setValue(compl.selectedProperty, { emitEvent: false });
            this.operatorControl.setValue(compl.selectedOperator, { emitEvent: false });
            fed.matchLiteralValueWithFallback({
              string: () => this.textWaardeControl.setValue(compl.selectedValue.value, { emitEvent: true }),
              integer: () => this.integerWaardeControl.setValue(compl.selectedValue.value, { emitEvent: true }),
              double: () => this.doubleWaardeControl.setValue(compl.selectedValue.value, { emitEvent: true }),
              fallback: () => {}
            })(compl.selectedValue);
          }
        })(expressionEditor.current);
      }
    });

    const operatorSelection$ = this.filterEditor$.pipe(
      map(fe => fe.current), // veiliger om enkel van filterEditor te beginnen
      filter(fed.isAtLeastOperatorSelection)
    );

    const properties$: rx.Observable<fltr.Property[]> = this.filterEditor$.pipe(map(editor => editor.current.properties));

    this.filteredVelden$ = rx.combineLatest(properties$, veldinfos$).pipe(
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

    const binaryOperators$: rx.Observable<fed.BinaryComparisonOperator[]> = operatorSelection$.pipe(map(os => os.operatorSelectors));

    this.filteredOperatoren$ = rx
      .combineLatest(
        this.operatorControl.valueChanges.pipe(
          filter(isNotNull),
          startWith<fed.BinaryComparisonOperator | string>(""), // nog niets ingetypt -> Moet beter kunnen!
          map(waarde => (typeof waarde === "string" ? waarde : waarde.label))
        ),
        binaryOperators$
      )
      .pipe(map(([getypt, operators]) => operators.filter(operator => operator.label.toLowerCase().startsWith(getypt.toLowerCase()))));

    const maybeZetFilterCmd$ = forEveryLaag(laag =>
      this.filterEditor$.pipe(
        tap(fe => console.log("*****filterEditor$ in maybeZetFilterCmd", fe)),
        map(fed.toExpressionFilter),
        map(maybeExpFilter => maybeExpFilter.map(expFilter => prt.ZetFilter(laag.titel, expFilter, kaartLogOnlyWrapper))),
        share()
      )
    );

    const geldigFilterCmd$ = maybeZetFilterCmd$.pipe(catOptions);
    this.ongeldigeFilter$ = maybeZetFilterCmd$.pipe(
      tap(cmd => console.log("****ongeldigeFilter$", cmd.isNone(), status)),
      map(cmd => cmd.isNone())
    );

    const laagNietZichtbaar$ = laag$.pipe(
      switchMap(laag =>
        kaart.modelChanges.viewinstellingen$.pipe(
          map(zi => zi.zoom < laag.bron.minZoom || zi.zoom > laag.bron.maxZoom),
          take(1)
        )
      )
    );

    const pasToeGeklikt$ = this.actionFor$("pasFilterToe");
    this.bindToLifeCycle(
      rx.combineLatest(laagNietZichtbaar$, geldigFilterCmd$).pipe(
        tap(lnz => console.log("****laagNietZichtbaar", lnz)),
        sample(pasToeGeklikt$)
      )
    ).subscribe(([laagNietZichtbaar, command]) => {
      this.dispatch(prt.MaakLaagZichtbaarCmd(command.titel, kaartLogOnlyWrapper));
      this.dispatch(prt.StopVectorFilterBewerkingCmd());
      if (laagNietZichtbaar) {
        this.dispatch(
          prt.MeldComponentFoutCmd([`De laag '${command.titel}' is niet zichtbaar op kaart op dit zoomniveau, gelieve verder in te zoomen`])
        );
      }
      this.dispatch(command);
    });
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

  displayOperator(operator?: fed.BinaryComparisonOperator): string | undefined {
    return operator ? operator.label : undefined;
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
}
