import { Component, NgZone } from "@angular/core";
import { FormControl, ValidationErrors, Validators } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { Endomorphism, Function1, Function2 } from "fp-ts/lib/function";
import { fromNullable, none, Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { combineLatest, filter, map, mapTo, sample, scan, shareReplay, startWith, switchMap, take, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { isNotNull, isNotNullObject } from "../util/function";
import { collectOption } from "../util/operators";
import { forEvery } from "../util/operators";

import { FilterAanpassingBezig, isAanpassingBezig } from "./filter-aanpassing-state";
import { FilterEditor as fed } from "./filter-builder";
import { Filter as fltr } from "./filter-model";

const autoCompleteSelectieVerplichtValidator: Function1<FormControl, ValidationErrors | null> = control => {
  if (typeof control.value === "string") {
    return { required: {} };
  }
  return null;
};

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

  readonly geldigFilterCmd$: rx.Observable<prt.ZetFilter<KaartInternalMsg>>;

  private clickInsideDialog = false;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    this.zichtbaar$ = kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig));

    const aanpassing$: rx.Observable<FilterAanpassingBezig> = kaart.modelChanges.laagFilterAanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
    );

    const findLaagOpTitel: Function2<string, ke.ToegevoegdeLaag[], Option<ke.ToegevoegdeVectorLaag>> = (titel, lgn) =>
      array.findFirst(lgn.filter(lg => lg.titel === titel), ke.isToegevoegdeVectorLaag);

    const laag$: rx.Observable<ke.ToegevoegdeVectorLaag> = forEvery(aanpassing$)(aanpassing =>
      kaart.modelChanges.lagenOpGroep
        .get(aanpassing.laag.laaggroep)!
        .pipe(collectOption(lgn => findLaagOpTitel(aanpassing.laag.titel, lgn)))
    );

    this.titel$ = laag$.pipe(map(laag => laag.titel));

    const forEveryLaag = forEvery(laag$);

    const forControlValue: Function1<FormControl, rx.Observable<any>> = formcontrol =>
      forEveryLaag(() =>
        formcontrol.valueChanges.pipe(
          startWith(formcontrol.value),
          shareReplay(1) // ook voor toekomstige subscribers
        )
      );

    const gekozenNaam$: rx.Observable<Option<string>> = forControlValue(this.naamControl).pipe(
      map(x => fromNullable(x).filter(x => x !== ""))
    );
    const gekozenOperator$: rx.Observable<fed.BinaryComparisonOperator> = forControlValue(this.operatorControl).pipe(
      filter(isNotNullObject)
    );
    const gekozenVeld$: rx.Observable<fltr.Property> = forControlValue(this.veldControl).pipe(filter(isNotNullObject));
    const gekozenWaarde$: rx.Observable<fltr.Literal> = forControlValue(this.waardeControl).pipe(
      filter(isNotNull),
      map(fltr.Literal) // Naar analogie met de andere observables moet dit ook direct kunnen
    );

    type TermEditorUpdate = Endomorphism<fed.TermEditor>;
    const zetNaam$: rx.Observable<Endomorphism<fed.ExpressionEditor>> = gekozenNaam$.pipe(map(fed.setName));
    const zetProperty$: rx.Observable<TermEditorUpdate> = gekozenVeld$.pipe(map(fed.OperatorSelection));
    const zetOperator$: rx.Observable<TermEditorUpdate> = gekozenOperator$.pipe(map(fed.ValueSelection));
    const zetWaarde$: rx.Observable<TermEditorUpdate> = gekozenWaarde$.pipe(map(fed.Completed));

    const initExpressionEditor$: rx.Observable<fed.ExpressionEditor> = laag$.pipe(map(fed.fromToegevoegdeVectorLaag));

    const termEditorUpdates$: rx.Observable<TermEditorUpdate> = rx.merge(zetProperty$, zetOperator$, zetWaarde$);

    const currentTermEditor$: rx.Observable<fed.TermEditor> = initExpressionEditor$.pipe(
      map(expEd => expEd.current),
      switchMap(initTermEditor =>
        termEditorUpdates$.pipe(scan((current: fed.TermEditor, update: TermEditorUpdate) => update(current), initTermEditor))
      )
    );

    const expressionEditorUpdates$ = rx.merge(zetNaam$, currentTermEditor$.pipe(map(fed.update)));

    const filterEditor$: rx.Observable<fed.ExpressionEditor> = initExpressionEditor$.pipe(
      switchMap(initExpressionEditor =>
        expressionEditorUpdates$.pipe(
          scan((expEd: fed.ExpressionEditor, update: Endomorphism<fed.ExpressionEditor>) => update(expEd), initExpressionEditor)
        )
      ),
      shareReplay(1)
    );

    // TODO biindToLifecycle
    rx.combineLatest(filterEditor$, kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig))).subscribe(
      ([expressionEditor, zichtbaar]) => {
        if (zichtbaar) {
          // zet control waarden bij aanpassen van expressionEditor
          expressionEditor.name.foldL(() => this.naamControl.reset(), name => this.naamControl.setValue(name));
          fed.matchTermEditor({
            Field: () => {
              this.veldControl.reset();
              this.operatorControl.reset();
              this.waardeControl.reset();
            },
            Operator: opr => {
              this.veldControl.setValue(opr.selectedProperty);
              this.operatorControl.reset();
              this.waardeControl.reset();
            },
            Value: val => {
              this.veldControl.setValue(val.selectedProperty);
              this.operatorControl.setValue(val.selectedOperator);
              this.waardeControl.reset();
            },
            Completed: compl => {
              this.veldControl.setValue(compl.selectedProperty);
              this.operatorControl.setValue(compl.selectedOperator);
              this.waardeControl.setValue(compl.selectedValue);
            }
          })(expressionEditor.current);
        }
      }
    );

    const operatorSelection$ = currentTermEditor$.pipe(filter(fed.isAtLeastOperatorSelection));

    const velden$: rx.Observable<fltr.Property[]> = currentTermEditor$.pipe(map(editor => editor.properties));

    this.filteredVelden$ = velden$.pipe(
      switchMap(properties =>
        this.veldControl.valueChanges.pipe(
          startWith<fltr.Property | string>(""), // nog niets ingetypt
          map(waarde => (typeof waarde === "string" ? waarde : fromNullable(waarde.label).getOrElse(""))),
          map(getypt =>
            properties.filter(veld =>
              fromNullable(veld.label)
                .getOrElse("")
                .toLowerCase()
                .startsWith(getypt.toLowerCase())
            )
          )
          // TODO ordBasisVeld maken, maar daarvoor uitbreiding Property (PrioritisedProperty bijv) nodig.
          // , map(velden => array.sort(ordBasisVeld)(velden))
        )
      ),
      shareReplay(1)
    );

    const binaryOperators$: rx.Observable<fed.BinaryComparisonOperator[]> = operatorSelection$.pipe(map(os => os.operatorSelectors));

    this.filteredOperatoren$ = rx
      .combineLatest(
        this.operatorControl.valueChanges.pipe(
          startWith<fed.BinaryComparisonOperator | string>(""), // nog niets ingetypt -> Moet beter kunnen!
          map(waarde => (typeof waarde === "string" ? waarde : waarde.label))
        ),
        binaryOperators$
      )
      .pipe(map(([getypt, operators]) => operators.filter(operator => operator.label.toLowerCase().startsWith(getypt.toLowerCase()))));

    this.geldigFilterCmd$ = forEveryLaag(laag =>
      filterEditor$.pipe(
        collectOption(fed.toExpressionFilter),
        map(expFilter => prt.ZetFilter(laag.titel, expFilter, kaartLogOnlyWrapper))
      )
    );

    // this.geldigFilterCmd$ = filterEditor$.pipe(
    //   switchMap(laag =>
    //     gekozenNaam$.pipe(
    //       switchMap(maybeNaam =>
    //         gekozenVeld$.pipe(
    //           switchMap(veldInfo =>
    //             gekozenOperator$.pipe(
    //               tap(() => this.waardeControl.enable()),
    //               switchMap(operator =>
    //                 gekozenWaarde$.pipe(
    //                   map(waarde =>
    //                     prt.ZetFilter(
    //                       laag.titel,
    //                       fltr.ExpressionFilter(
    //                         maybeNaam,
    //                         operator.build(
    //                           fltr.Property(veldInfo.type, veldInfo.naam, fromNullable(veldInfo.label).getOrElse("")),
    //                           fltr.Literal("string", waarde)
    //                         )
    //                       ),
    //                       kaartLogOnlyWrapper
    //                     )
    //                   )
    //                 )
    //               )
    //             )
    //           )
    //         )
    //       )
    //     )
    //   )
    // );

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
        combineLatest(this.geldigFilterCmd$),
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

  onClickOutside(event: Event) {
    if (!this.clickInsideDialog) {
      this.close();
    }
    this.clickInsideDialog = false;
    return false;
  }

  onClickInside(event: Event) {
    this.clickInsideDialog = true;
    return false;
  }
}
