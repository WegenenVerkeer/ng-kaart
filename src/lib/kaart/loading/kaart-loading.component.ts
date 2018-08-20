import { Component, NgZone } from "@angular/core";
import { List } from "immutable";
import * as rx from "rxjs";
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  mergeAll,
  scan,
  shareReplay,
  startWith,
  switchMap,
  switchMapTo,
  take
} from "rxjs/operators";

import { NosqlFsSource } from "../../source/nosql-fs-source";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { isNoSqlFsLaag, ToegevoegdeLaag, VectorLaag } from "../kaart-elementen";
import { DataLoadEvent, LoadError } from "../kaart-load-events";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

@Component({
  selector: "awv-ladend",
  templateUrl: "./kaart-loading.component.html",
  styleUrls: ["./kaart-loading.component.scss"]
})
export class KaartLoadingComponent extends KaartChildComponentBase {
  readonly activityClass$: rx.Observable<string>;
  readonly progressStyle$: rx.Observable<object>;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    const noSqlFsLagenDataLoadEvents: (_: List<ToegevoegdeLaag>) => List<rx.Observable<DataLoadEvent>> = lgn =>
      lgn
        .map(lg => lg!.bron) // ga naar de onderliggende laag
        .filter(isNoSqlFsLaag) // hou enkel de VectorLagen met een een noSqlFsSource over
        .map(lg => ((lg as VectorLaag)!.source as NosqlFsSource).loadEvent$)
        .toList();

    const lagenHoog$$: rx.Observable<List<rx.Observable<DataLoadEvent>>> = this.modelChanges.lagenOpGroep
      .get("Voorgrond.Hoog")
      .pipe(map(noSqlFsLagenDataLoadEvents), startWith(List()));
    const lagenLaag$$: rx.Observable<List<rx.Observable<DataLoadEvent>>> = this.modelChanges.lagenOpGroep
      .get("Voorgrond.Laag")
      .pipe(map(noSqlFsLagenDataLoadEvents), startWith(List()));
    const toegevoegdeLagen$$: rx.Observable<List<rx.Observable<DataLoadEvent>>> = lagenHoog$$.pipe(
      combineLatest(lagenLaag$$, (lgnHg, lgnLg) => lgnHg.concat(lgnLg).toList())
    );
    const mergedDataloadEvent$: rx.Observable<DataLoadEvent> = toegevoegdeLagen$$.pipe(
      // subscribe/unsubscribe voor elke nieuwe lijst van toegevoegde lagen
      switchMap(lgn => rx.from(lgn.toArray()).pipe(mergeAll())),
      shareReplay(1, 1000)
    );
    const numBusy$: rx.Observable<number> = mergedDataloadEvent$.pipe(
      scan((numBusy: number, evt: DataLoadEvent) => {
        switch (evt.type) {
          case "LoadStart":
            return numBusy + 1;
          case "LoadComplete":
            return numBusy - 1;
          case "LoadError":
            return numBusy - 1;
          case "PartReceived":
            // We doen hier dus niks mee, maar we zouden ook een tick kunnen geven.
            // Echter maar interessant als we het totaal aantal chunks kennen.
            return numBusy;
        }
      }, 0)
    );
    const stableError$ = (stability: number) => mergedDataloadEvent$.pipe(ofType<LoadError>("LoadError"), debounceTime(stability));

    const busy$: rx.Observable<boolean> = numBusy$.pipe(map(numBusy => numBusy > 0), distinctUntilChanged(), shareReplay(1));
    const inError$: rx.Observable<boolean> = stableError$(100).pipe(
      switchMapTo(rx.timer(0, 1000).pipe(map(t => t === 0), take(2))), // Produceert direct true, dan na een seconde false
      startWith(false)
    );

    // busy$ heeft voorrang op inactive$
    this.activityClass$ = busy$.pipe(
      combineLatest(inError$, (busy, error) => (busy ? "active" : error ? "error" : "inactive")),
      observeOnAngular(this.zone)
    );

    // We willen het "oog" verbergen wanneer we in de error toestand zijn
    this.progressStyle$ = inError$.pipe(
      switchMap(
        inError =>
          inError
            ? rx.of({ "margin-left": "-10000px" })
            : busy$.pipe(
                switchMap(
                  busy =>
                    busy
                      ? rx.timer(0, 200).pipe(
                          // 110 = 11 * 10 . De modulus moet het eerste geheel veelvoud van het aantal onderverdelingen > 100 zijn.
                          map(n => ({ "margin-left": (n * 11) % 110 + "%" }))
                        )
                      : rx.of({})
                )
              )
      ),
      observeOnAngular(this.zone)
    );

    this.bindToLifeCycle(stableError$(500)).subscribe(evt =>
      this.dispatch(prt.MeldComponentFoutCmd(List.of("Fout bij laden van features: " + evt.error)))
    );
  }
}
