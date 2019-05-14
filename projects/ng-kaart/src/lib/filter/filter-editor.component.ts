import { Component, NgZone } from "@angular/core";
import { FormControl, ValidationErrors, Validators } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { Endomorphism, Function1 } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as option from "fp-ts/lib/Option";
import { contramap, Ord, ordBoolean } from "fp-ts/lib/Ord";
import * as ord from "fp-ts/lib/Ord";
import * as rx from "rxjs";
import {
  combineLatest,
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
  throttleTime
} from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { kaartLogger } from "../kaart/log";
import { isNotNull, isNotNullObject } from "../util/function";
import { catOptions, forEvery, subSpy } from "../util/operators";

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
  readonly waardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);

  readonly ongeldigeFilter$: rx.Observable<boolean>;

  private clickInsideDialog = false;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    this.zichtbaar$ = kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig));

    const aanpassing$: rx.Observable<FilterAanpassingBezig> = kaart.modelChanges.laagFilterAanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
    );

    const laag$: rx.Observable<ke.ToegevoegdeVectorLaag> = subSpy("****laag")(
      aanpassing$.pipe(
        map(aanpassing => aanpassing.laag),
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
          startWith(formcontrol.value),
          filter(() => formcontrol.enabled),
          shareReplay(1) // ook voor toekomstige subscribers
        )
      );

    const gekozenNaam$: rx.Observable<Option<string>> = subSpy("****gekozenNaam$")(
      forControlValue(this.naamControl).pipe(
        debounceTime(100), // voor de snelle typers
        distinctUntilChanged(),
        map(x => fromNullable(x).filter(x => x !== ""))
      )
    ).pipe(share());
    const gekozenVeld$: rx.Observable<fltr.Property> = forControlValue(this.veldControl).pipe(
      filter(isNotNullObject),
      distinctUntilChanged() // gebruikt object identity, maar de onderliggende objecten worden geherbruikt dus geen probleem
    );
    const gekozenOperator$: rx.Observable<fed.BinaryComparisonOperator> = forControlValue(this.operatorControl).pipe(
      filter(isNotNullObject),
      tap(o => console.log("*****Operator gekozen", o)),
      distinctUntilChanged(), // gebruikt object identity, maar de onderliggende objecten worden geherbruikt dus geen probleem
      tap(o => console.log("*****Distinct operator gekozen", o))
    );
    const gekozenWaarde$: rx.Observable<fltr.Literal> = forControlValue(this.waardeControl).pipe(
      filter(isNotNull),
      distinctUntilChanged(), // in dit geval vgln we op strings, dus ook OK
      map(value => fltr.Literal("string", value))
    );

    type TermEditorUpdate = Endomorphism<fed.TermEditor>;
    const zetNaam$: rx.Observable<Endomorphism<fed.ExpressionEditor>> = gekozenNaam$.pipe(map(fed.setName));
    const zetProperty$: rx.Observable<TermEditorUpdate> = gekozenVeld$.pipe(map(fed.OperatorSelection));
    const zetOperator$: rx.Observable<TermEditorUpdate> = gekozenOperator$.pipe(map(fed.ValueSelection));
    const zetWaarde$: rx.Observable<TermEditorUpdate> = gekozenWaarde$.pipe(map(fed.Completed));

    const initExpressionEditor$: rx.Observable<fed.ExpressionEditor> = subSpy("****initExpressionEditor$")(
      laag$.pipe(
        map(fed.fromToegevoegdeVectorLaag),
        share()
      )
    );

    const termEditorUpdates$: rx.Observable<TermEditorUpdate> = rx.merge(zetProperty$, zetOperator$, zetWaarde$);

    const currentTermEditor$: rx.Observable<fed.TermEditor> = subSpy("****currentTermEditor$")(
      initExpressionEditor$.pipe(
        map(expEd => expEd.current),
        switchMap(initTermEditor =>
          termEditorUpdates$.pipe(
            scan((current: fed.TermEditor, update: TermEditorUpdate) => update(current), initTermEditor),
            startWith(initTermEditor)
          )
        ),
        share()
      )
    );

    const expressionEditorUpdates$ = rx.merge(zetNaam$, currentTermEditor$.pipe(map(fed.update)));

    const filterEditor$: rx.Observable<fed.ExpressionEditor> = subSpy("****filterEditor$")(
      initExpressionEditor$.pipe(
        switchMap(initExpressionEditor =>
          expressionEditorUpdates$.pipe(
            scan((expEd: fed.ExpressionEditor, update: Endomorphism<fed.ExpressionEditor>) => update(expEd), initExpressionEditor),
            startWith(initExpressionEditor),
            tap(expressionEditor => kaartLogger.debug("****expressionEditor", expressionEditor)),
            throttleTime(100)
          )
        ),
        share()
      )
    );

    // Deze subscribe zorgt er voor dat de updates effectief uitgevoerd worden
    this.bindToLifeCycle(
      rx.combineLatest(filterEditor$, kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig)))
    ).subscribe(([expressionEditor, zichtbaar]) => {
      if (zichtbaar) {
        // zet control waarden bij aanpassen van expressionEditor
        expressionEditor.name.foldL(() => this.naamControl.reset(), name => this.naamControl.setValue(name, { emitEvent: false }));
        fed.matchTermEditor({
          Field: () => {
            this.veldControl.reset(undefined, { emitEvent: false });
            this.operatorControl.reset(undefined, { emitEvent: false });
            this.operatorControl.disable();
            this.waardeControl.reset(undefined, { emitEvent: false });
            this.waardeControl.disable();
          },
          Operator: opr => {
            this.veldControl.setValue(opr.selectedProperty, { emitEvent: false });
            this.operatorControl.reset(undefined, { emitEvent: false });
            this.operatorControl.enable({ emitEvent: false });
            this.waardeControl.reset(undefined, { emitEvent: false });
            this.waardeControl.disable();
          },
          Value: val => {
            this.veldControl.setValue(val.selectedProperty, { emitEvent: false });
            this.operatorControl.setValue(val.selectedOperator, { emitEvent: false });
            this.operatorControl.enable({ emitEvent: false });
            this.waardeControl.reset(undefined, { emitEvent: false });
            this.waardeControl.enable({ emitEvent: false });
          },
          Completed: compl => {
            this.veldControl.setValue(compl.selectedProperty, { emitEvent: false });
            this.operatorControl.setValue(compl.selectedOperator, { emitEvent: false });
            this.operatorControl.enable({ emitEvent: false });
            this.waardeControl.setValue(compl.selectedValue.value, { emitEvent: false });
            this.waardeControl.enable({ emitEvent: false });
          }
        })(expressionEditor.current);
      }
    });

    const operatorSelection$ = currentTermEditor$.pipe(filter(fed.isAtLeastOperatorSelection));

    const properties$: rx.Observable<fltr.Property[]> = subSpy("****velden$")(
      filterEditor$.pipe(
        map(editor => editor.current.properties),
        shareReplay(1)
      )
    );

    this.filteredVelden$ = subSpy("****filteredVelden$")(
      rx.combineLatest(properties$, veldinfos$).pipe(
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
      )
    );

    const binaryOperators$: rx.Observable<fed.BinaryComparisonOperator[]> = subSpy("****binaryOperators$")(
      operatorSelection$.pipe(map(os => os.operatorSelectors))
    );

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
      filterEditor$.pipe(
        map(fed.toExpressionFilter),
        map(maybeExpFilter => maybeExpFilter.map(expFilter => prt.ZetFilter(laag.titel, expFilter, kaartLogOnlyWrapper))),
        share()
      )
    );

    const geldigFilterCmd$ = maybeZetFilterCmd$.pipe(catOptions);
    this.ongeldigeFilter$ = maybeZetFilterCmd$.pipe(map(m => m.isNone()));

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
      laagNietZichtbaar$.pipe(
        combineLatest(geldigFilterCmd$),
        sample(pasToeGeklikt$)
      )
    ).subscribe(([laagNietZichtbaar, command]) => {
      this.dispatch(prt.StopVectorFilterBewerkingCmd());
      this.dispatch(command);
      this.dispatch(prt.MaakLaagZichtbaarCmd(command.titel, kaartLogOnlyWrapper));
      if (laagNietZichtbaar) {
        this.dispatch(
          prt.MeldComponentFoutCmd([`De laag '${command.titel}' is niet zichtbaar op kaart op dit zoomniveau, gelieve verder in te zoomen`])
        );
      }
    });
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

  errorWaarde(): string {
    return this.waardeControl.hasError("required") ? "Gelieve een waarde in te geven" : "";
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
