import { Component, NgZone } from "@angular/core";
import { FormControl, ValidationErrors, Validators } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { Function1, Function2 } from "fp-ts/lib/function";
import { fromNullable, none, Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { Observable } from "rxjs";
import { combineLatest, filter, map, sample, shareReplay, startWith, switchMap, take, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { VeldInfo } from "../kaart/kaart-elementen";
import { ToegevoegdeVectorLaag } from "../kaart/kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { isNotNull, isNotNullObject } from "../util/function";
import { collectOption } from "../util/operators";
import { forEvery } from "../util/operators";

import { FilterAanpassingBezig, isAanpassingBezig } from "./filter-aanpassing-state";
import { FilterBuilder } from "./filter-builder";
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

  readonly filteredVelden$: rx.Observable<VeldInfo[]>;
  readonly filteredOperatoren$: rx.Observable<FilterBuilder.FilterBuildElement[]>;

  readonly naamControl = new FormControl("");
  readonly veldControl = new FormControl("", [Validators.required, autoCompleteSelectieVerplichtValidator]);
  readonly operatorControl = new FormControl(FilterBuilder.comparisonBuilders.find(operator => operator.description === "is"), [
    Validators.required,
    autoCompleteSelectieVerplichtValidator
  ]);
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
    ).pipe(
      switchMap(laag =>
        kaart.modelChanges.laagFilterAanpassingState$.pipe(map(isAanpassingBezig)).pipe(
          tap(zichtbaar => {
            if (zichtbaar) {
              // zet control waarden bij start aanpassen filter van een laag
              if (laag.filterinstellingen.spec.kind === "ExpressionFilter") {
                const exprFilter = laag.filterinstellingen.spec as fltr.ExpressionFilter; // TODO dit moet veralgemeend worden
                this.naamControl.setValue(exprFilter.name.toNullable());
                const comparison = exprFilter.expression as fltr.Comparison;
                this.veldControl.setValue(
                  ToegevoegdeVectorLaag.veldInfosLens.get(laag).find(veldinfo => veldinfo.naam === comparison.property.ref)
                );
                this.operatorControl.setValue(
                  comparison.kind === "Equality"
                    ? FilterBuilder.comparisonBuilders.find(operator => operator.description === "is")
                    : FilterBuilder.comparisonBuilders.find(operator => operator.description === "is niet")
                );
                this.waardeControl.setValue(comparison.value.value);
              } else {
                this.naamControl.reset();
                this.veldControl.reset();
                this.operatorControl.reset(FilterBuilder.comparisonBuilders.find(operator => operator.description === "is"));
                this.waardeControl.reset();
              }
            }
          }),
          map(() => laag)
        )
      ),
      shareReplay(1)
    );

    const velden$: rx.Observable<VeldInfo[]> = laag$.pipe(
      map(laag =>
        ToegevoegdeVectorLaag.veldInfosLens.get(laag).filter(
          // filter de speciale velden er uit
          veld =>
            fromNullable(veld.label).isSome() &&
            fromNullable(veld.constante).isNone() &&
            fromNullable(veld.template).isNone() &&
            fromNullable(veld.html).isNone() &&
            veld.type !== "geometry" &&
            veld.type !== "json"
        )
      )
    );

    this.filteredVelden$ = velden$.pipe(
      switchMap(velden =>
        this.veldControl.valueChanges.pipe(
          startWith<VeldInfo | string>(""), // nog niets ingetypt
          map(waarde => (typeof waarde === "string" ? waarde : fromNullable(waarde.label).getOrElse(""))),
          map(getypt =>
            velden.filter(veld =>
              fromNullable(veld.label)
                .getOrElse("")
                .toLowerCase()
                .startsWith(getypt.toLowerCase())
            )
          ),
          map(velden => velden.sort((a, b) => (a.isBasisVeld === b.isBasisVeld ? 0 : a.isBasisVeld ? -1 : 1)))
          // opletten: mutable! Gebruik van fp-ts
        )
      ),
      shareReplay(1)
    );

    this.titel$ = laag$.pipe(map(laag => laag.titel));

    this.filteredOperatoren$ = this.operatorControl.valueChanges.pipe(
      startWith<FilterBuilder.FilterBuildElement | string>(""), // nog niets ingetypt -> Moet beter kunnen!
      map(waarde => (typeof waarde === "string" ? waarde : waarde.description)),
      map(getypt =>
        FilterBuilder.comparisonBuilders.filter(
          operator => operator.description.toLowerCase().startsWith(getypt) || operator.description.startsWith(getypt)
        )
      )
    );

    const forEveryLaag = forEvery(laag$);

    const forControlValue: Function1<FormControl, Observable<any>> = formcontrol =>
      forEveryLaag(() =>
        formcontrol.valueChanges.pipe(
          startWith(formcontrol.value),
          shareReplay(1) // ook voor toekomstige subscribers
        )
      );

    const gekozenNaam$: Observable<Option<string>> = forControlValue(this.naamControl).pipe(map(x => (x === "" ? none : fromNullable(x))));
    const gekozenOperator$: Observable<FilterBuilder.FilterBuildElement> = forControlValue(this.operatorControl).pipe(
      filter(isNotNullObject)
    );
    const gekozenVeld$: Observable<VeldInfo> = forControlValue(this.veldControl).pipe(filter(isNotNullObject));
    const gekozenWaarde$: Observable<string> = forControlValue(this.waardeControl).pipe(filter(isNotNull));

    this.geldigFilterCmd$ = laag$.pipe(
      switchMap(laag =>
        gekozenNaam$.pipe(
          switchMap(maybeNaam =>
            gekozenVeld$.pipe(
              switchMap(veldInfo =>
                gekozenOperator$.pipe(
                  tap(() => this.waardeControl.enable()),
                  switchMap(operator =>
                    gekozenWaarde$.pipe(
                      map(waarde =>
                        prt.ZetFilter(
                          laag.titel,
                          fltr.ExpressionFilter(
                            maybeNaam,
                            operator.build(
                              fltr.Property(veldInfo.type, veldInfo.naam, fromNullable(veldInfo.label).getOrElse("")),
                              fltr.Literal("string", waarde)
                            )
                          ),
                          kaartLogOnlyWrapper
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
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
      laagNietZichtbaar$.pipe(
        combineLatest(this.geldigFilterCmd$),
        sample(pasToeGeklikt$)
      )
    ).subscribe(([laagNietZichtbaar, command]) => {
      this.dispatch(prt.StopVectorFilterBewerkingCmd());
      this.dispatch(prt.MaakLaagZichtbaarCmd(command.titel, kaartLogOnlyWrapper));
      if (laagNietZichtbaar) {
        this.dispatch(
          prt.MeldComponentFoutCmd([`De laag '${command.titel}' is niet zichtbaar op kaart op dit zoomniveau, gelieve verder in te zoomen`])
        );
      }
      this.dispatch(command);
    });
  }

  close() {
    this.dispatch(prt.StopVectorFilterBewerkingCmd());
  }

  displayVeld(veld?: VeldInfo): string | undefined {
    return veld ? veld.label : undefined;
  }

  errorVeld() {
    return this.veldControl.hasError("required") ? "Gelieve een eigenschap te kiezen" : "";
  }

  displayOperator(operator?: FilterBuilder.FilterBuildElement): string | undefined {
    return operator ? operator.description : undefined;
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
