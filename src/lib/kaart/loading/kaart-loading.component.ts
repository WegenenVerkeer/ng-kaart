import { Component, NgZone } from "@angular/core";
import { List } from "immutable";
import * as rx from "rxjs";
import { OperatorFunction } from "rxjs/interfaces";
import { distinctUntilChanged, map, mergeAll, scan, switchMap, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { isNoSqlFsLaag, NoSqlFsLaag, ToegevoegdeLaag } from "../kaart-elementen";
import { DataLoadEvent } from "../kaart-load-events";
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

    const toegevoegdeLagenToLoadEvents: (_: List<ToegevoegdeLaag>) => rx.Observable<DataLoadEvent> = (lgn: List<ToegevoegdeLaag>) =>
      rx.Observable.from(
        lgn
          .map(lg => lg!.bron) // ga naar de onderliggende laag
          .filter(isNoSqlFsLaag) // hou enkel de noSqlFsLagen over
          .map(lg => (lg as NoSqlFsLaag).source.loadEvent$) // kijk naar de load evts
          .toArray()
      ).pipe(mergeAll() as OperatorFunction<rx.Observable<DataLoadEvent>, DataLoadEvent>);

    const lagenHoog$: rx.Observable<List<ToegevoegdeLaag>> = this.modelChanges.lagenOpGroep$.get("Voorgrond.Hoog");
    const lagenLaag$: rx.Observable<List<ToegevoegdeLaag>> = this.modelChanges.lagenOpGroep$.get("Voorgrond.Laag");
    const dataloadEvent$: rx.Observable<DataLoadEvent> = lagenHoog$.pipe(
      // subscribe/unsubscribe voor elke nieuwe lijst van toegevoegde lagen
      switchMap(toegevoegdeLagenToLoadEvents)
    );
    const numBusy$: rx.Observable<number> = dataloadEvent$.pipe(
      scan((numBusy: number, evt: DataLoadEvent) => {
        switch (evt) {
          case "LoadStart":
            return numBusy + 1;
          case "LoadComplete":
            return numBusy - 1;
          case "LoadError":
            return numBusy - 1;
          case "ChunkReceived":
            // We doen hier dus niks mee, maar we zouden ook een tick kunnen geven.
            // Echter maar interessant als we het totaal aantal chunks kennen.
            return numBusy;
        }
      }, 0)
    );
    const busy$: rx.Observable<boolean> = numBusy$.pipe(map(numBusy => numBusy > 0), distinctUntilChanged());

    this.activityClass$ = busy$.pipe(map(busy => (busy ? "active" : "inactive")));
    // 110 = 11 * 10 . De modulus moet het eerste geheel veelvoud van het aantal onderverdelingen > 100 zijn.
    this.progressStyle$ = rx.Observable.timer(0, 200).pipe(map(n => ({ "margin-left": (n * 11) % 110 + "%" })));
  }
}
