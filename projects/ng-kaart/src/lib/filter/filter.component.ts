import { Component, NgZone } from "@angular/core";
import { FormControl } from "@angular/forms";
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
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { collectOption, forEvery, isNotNullObject } from "../util";

import { FilterAanpassingBezig, isAanpassingBezig } from "./filter-aanpassing-state";
import { beschikbareOperatoren, Is, Operator, Property, SimpleFilter } from "./filter-model";

@Component({
  selector: "awv-filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent extends KaartChildComponentBase {
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;
  readonly velden$: rx.Observable<VeldInfo[]>;
  readonly veldControl = new FormControl({ value: "", disabled: false });
  readonly operatorControl = new FormControl({ value: Is.symbool, disabled: false });
  readonly waardeControl = new FormControl({ value: "", disabled: false });

  readonly beschikbareOperatoren = beschikbareOperatoren;

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
      tap(laag => console.log(laag)),
      shareReplay(1) // De huidige laag moet bewaard blijven voor alle volgende subscribers
    );

    this.velden$ = laag$.pipe(map(laag => ToegevoegdeVectorLaag.veldInfosLens.get(laag)));

    this.titel$ = laag$.pipe(map(laag => laag.titel));

    const forEveryLaag = forEvery(laag$);

    const forControlValue: Function1<FormControl, Observable<string>> = formcontrol =>
      forEveryLaag(() =>
        formcontrol.valueChanges.pipe(
          startWith(formcontrol.value),
          shareReplay(1) // ook voor toekomstige subscribers
        )
      );

    const gekozenOperator$: Observable<string> = forControlValue(this.operatorControl);
    const gekozenWaarde$: Observable<string> = forControlValue(this.waardeControl);
    const gekozenVeld$: Observable<VeldInfo> = laag$.pipe(
      switchMap(laag =>
        forControlValue(this.veldControl).pipe(
          map(veldNaam => ToegevoegdeVectorLaag.veldInfosLens.get(laag).find(veldInfo => veldInfo.naam === veldNaam)),
          filter(isNotNullObject)
        )
      )
    );

    const zetFilterCmd$ = laag$.pipe(
      switchMap(laag =>
        gekozenVeld$.pipe(
          switchMap(veldInfo =>
            gekozenOperator$.pipe(
              switchMap(operator =>
                gekozenWaarde$.pipe(
                  map(waarde =>
                    prt.ZetFilter(
                      laag.titel,
                      some(SimpleFilter(Property(veldInfo.type, veldInfo.naam), waarde, Operator(operator))),
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
    this.bindToLifeCycle(zetFilterCmd$.pipe(sample(pasToeGeklikt$))).subscribe(command => {
      this.dispatch(command);
      this.dispatch(prt.StopVectorFilterBewerkingCmd());
    });
  }

  close() {
    this.dispatch(prt.StopVectorFilterBewerkingCmd());
  }
}
