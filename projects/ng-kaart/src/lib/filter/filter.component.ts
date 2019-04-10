import { Component, NgZone } from "@angular/core";
import { FormControl, ValidationErrors, Validators } from "@angular/forms";
import * as array from "fp-ts/lib/Array";
import { Function1, Function2 } from "fp-ts/lib/function";
import { Option, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { Observable } from "rxjs";
import { filter, map, sample, shareReplay, startWith, switchMap, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { VeldInfo } from "../kaart/kaart-elementen";
import { ToegevoegdeVectorLaag } from "../kaart/kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { collectOption, forEvery, isNotNull, isNotNullObject } from "../util";

import { FilterAanpassingBezig, isAanpassingBezig } from "./filter-aanpassing-state";
import { beschikbareOperatoren, Is, Operator, Property, SimpleFilter } from "./filter-model";

const autoCompleteSelectieVerplichtValidator: Function1<FormControl, ValidationErrors | null> = control => {
  if (typeof control.value === "string") {
    return { required: {} };
  }
  return null;
};

@Component({
  selector: "awv-filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent extends KaartChildComponentBase {
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;

  readonly filteredVelden$: rx.Observable<VeldInfo[]>;
  readonly filteredOperatoren$: rx.Observable<Operator[]>;

  readonly veldControl = new FormControl("", [Validators.required, autoCompleteSelectieVerplichtValidator]);
  readonly operatorControl = new FormControl(Is, [Validators.required, autoCompleteSelectieVerplichtValidator]);
  readonly waardeControl = new FormControl({ value: null, disabled: true }, [Validators.required]);

  readonly geldigFilterCmd$: rx.Observable<prt.ZetFilter<KaartInternalMsg>>;

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
      shareReplay(1) // De huidige laag moet bewaard blijven voor alle volgende subscribers
    );

    const velden$: rx.Observable<VeldInfo[]> = laag$.pipe(map(laag => ToegevoegdeVectorLaag.veldInfosLens.get(laag)));

    this.titel$ = laag$.pipe(map(laag => laag.titel));

    this.filteredVelden$ = velden$.pipe(
      switchMap(velden =>
        this.veldControl.valueChanges.pipe(
          startWith<VeldInfo | string>(""), // nog niets ingetypt
          map(waarde => (typeof waarde === "string" ? waarde : waarde.label)),
          map(getypt => velden.filter(veld => veld.label.toLowerCase().startsWith(getypt.toLowerCase()))),
          map(velden => velden.sort((a, b) => a.label.localeCompare(b.label)))
        )
      )
    );

    this.filteredOperatoren$ = this.operatorControl.valueChanges.pipe(
      startWith<Operator | string>(""), // nog niets ingetypt
      map(waarde => (typeof waarde === "string" ? waarde : waarde.beschrijving)),
      map(getypt =>
        beschikbareOperatoren.filter(
          operator => operator.beschrijving.toLowerCase().startsWith(getypt) || operator.symbool.startsWith(getypt)
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

    const gekozenOperator$: Observable<Operator> = forControlValue(this.operatorControl).pipe(filter(isNotNullObject));
    const gekozenVeld$: Observable<VeldInfo> = forControlValue(this.veldControl).pipe(filter(isNotNullObject));
    const gekozenWaarde$: Observable<string> = forControlValue(this.waardeControl).pipe(filter(isNotNull));

    this.geldigFilterCmd$ = laag$.pipe(
      switchMap(laag =>
        gekozenVeld$.pipe(
          switchMap(veldInfo =>
            gekozenOperator$.pipe(
              tap(() => this.waardeControl.enable()),
              switchMap(operator =>
                gekozenWaarde$.pipe(
                  map(waarde =>
                    prt.ZetFilter(
                      laag.titel,
                      some(SimpleFilter(Property(veldInfo.type, veldInfo.naam), waarde, operator)),
                      kaartLogOnlyWrapper
                    )
                  )
                )
              )
            )
          )
        )
      )
    );

    const pasToeGeklikt$ = this.actionFor$("pasFilterToe");
    this.bindToLifeCycle(this.geldigFilterCmd$.pipe(sample(pasToeGeklikt$))).subscribe(command => {
      this.dispatch(command);
      this.dispatch(prt.StopVectorFilterBewerkingCmd());
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

  displayOperator(operator?: Operator): string | undefined {
    return operator ? operator.beschrijving : undefined;
  }

  errorOperator() {
    return this.operatorControl.hasError("required") ? "Gelieve een operator te kiezen" : "";
  }

  errorWaarde() {
    return this.waardeControl.hasError("required") ? "Gelieve een waarde in te geven" : "";
  }
}
