import { Component, NgZone } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { Predicate } from "fp-ts/lib/function";
import { List } from "immutable";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, map, mergeAll, shareReplay, startWith, switchMap, switchMapTo, take } from "rxjs/operators";

import { NosqlFsSource } from "../../source/nosql-fs-source";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { isNoSqlFsLaag, ToegevoegdeLaag, VectorLaag } from "../kaart-elementen";
import { DataLoadEvent, LoadComplete, LoadError } from "../kaart-load-events";
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
        // We moeten de dataloadEvents hier doen starten met een LoadComplete event,
        // want het kan zijn dat er lagen zijn die al gereed zijn en dus nooit een event zouden uitsturen
        .map(lg => ((lg as VectorLaag)!.source as NosqlFsSource).loadEvent$.pipe(startWith(LoadComplete as DataLoadEvent)))
        .toList();

    const lagenHoog$$: rx.Observable<List<rx.Observable<DataLoadEvent>>> = this.modelChanges.lagenOpGroep
      .get("Voorgrond.Hoog")
      .pipe(map(noSqlFsLagenDataLoadEvents), startWith(List<rx.Observable<DataLoadEvent>>()));
    const lagenLaag$$: rx.Observable<List<rx.Observable<DataLoadEvent>>> = this.modelChanges.lagenOpGroep
      .get("Voorgrond.Laag")
      .pipe(map(noSqlFsLagenDataLoadEvents), startWith(List<rx.Observable<DataLoadEvent>>()));

    const toegevoegdeLagenEvts$$: rx.Observable<List<rx.Observable<DataLoadEvent>>> = rx.combineLatest(
      lagenHoog$$,
      lagenLaag$$,
      (lgnHg, lgnLg) => lgnHg.concat(lgnLg).toList()
    );

    // Als het laaste event voor een laag LoadStart of PartReceived is, is de laag nog bezig met laden.
    const isBusyEvent: Predicate<DataLoadEvent> = dlEvt => dlEvt.type === "LoadStart" || dlEvt.type === "PartReceived";
    // Als tenminste 1 van de events een busy event is, dan wordt er nog op data gewacht
    const notWaitingForMoreData: Predicate<DataLoadEvent[]> = dlEvts => array.isEmpty(array.filter(dlEvts, isBusyEvent));

    const busy$: rx.Observable<boolean> = toegevoegdeLagenEvts$$.pipe(
      switchMap(lagenEvts$ => rx.combineLatest(lagenEvts$.toArray())),
      map(notWaitingForMoreData), // dus true als alle data binnen is
      startWith(false), // dus std wel wachten op data
      distinctUntilChanged()
    );

    const mergedDataloadEvent$: rx.Observable<DataLoadEvent> = toegevoegdeLagenEvts$$.pipe(
      // subscribe/unsubscribe voor elke nieuwe lijst van toegevoegde lagen
      switchMap(lgn => rx.from(lgn.toArray()).pipe(mergeAll())),
      shareReplay(1, 1000)
    );
    const stableError$ = (stability: number) => mergedDataloadEvent$.pipe(ofType<LoadError>("LoadError"), debounceTime(stability));

    const inError$: rx.Observable<boolean> = stableError$(100).pipe(
      switchMapTo(rx.timer(0, 1000).pipe(map(t => t === 0), take(2))), // Produceert direct true, dan na een seconde false
      startWith(false)
    );

    // busy$ heeft voorrang op inactive$
    this.activityClass$ = rx
      .combineLatest(busy$, inError$, (busy, error) => (busy ? "active" : error ? "error" : "inactive"))
      .pipe(observeOnAngular(this.zone));

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
