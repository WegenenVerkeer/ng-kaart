import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import { array, option } from "fp-ts";
import { Function2, identity } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, sample, shareReplay, startWith, tap } from "rxjs/operators";

import { KaartChildDirective } from "../kaart/kaart-child.directive";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { isNumber } from "../util/number";
import { collectOption, forEvery } from "../util/operators";

import { isAanpassingBezig, isAanpassingNietBezig, TransparantieaanpassingBezig } from "./state";
import { Transparantie } from "./transparantie";

@Component({
  selector: "awv-transparantieeditor",
  templateUrl: "./transparantieeditor.component.html",
  styleUrls: ["./transparantieeditor.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransparantieeditorComponent extends KaartChildDirective {
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;
  readonly nietToepassen$: rx.Observable<boolean>;
  readonly gezetteWaarde$: rx.Observable<number>;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    const aanpassing$: rx.Observable<TransparantieaanpassingBezig> = kaart.modelChanges.transparantieaanpassingState$.pipe(
      filter(isAanpassingBezig),
      shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
    );
    const geenAanpassing$ = kaart.modelChanges.transparantieaanpassingState$.pipe(filter(isAanpassingNietBezig));

    this.zichtbaar$ = kaart.modelChanges.transparantieaanpassingState$.pipe(map(isAanpassingBezig));

    const findLaagOpTitel: Function2<string, ke.ToegevoegdeLaag[], option.Option<ke.ToegevoegdeLaag>> = (titel, lgn) =>
      array.findFirst(lgn, lg => lg.titel === titel);
    const laag$: rx.Observable<ke.ToegevoegdeLaag> = forEvery(aanpassing$)(aanpassing =>
      kaart.modelChanges.lagenOpGroep[aanpassing.laag.laaggroep].pipe(
        collectOption(lgn => findLaagOpTitel(aanpassing.laag.titel, lgn)),
        startWith(aanpassing.laag)
      )
    ).pipe(
      shareReplay(1) // De huidige laag moet bewaard blijven voor alle volgende subscribers
    );

    this.titel$ = laag$.pipe(map(laag => laag.titel));
    this.gezetteWaarde$ = laag$.pipe(
      map(laag => laag.transparantie),
      map(Transparantie.toNumber),
      distinctUntilChanged(),
      shareReplay(1)
    );

    const pasToeClick$ = this.actionFor$("pasTransparantieToe");

    const waarde$: rx.Observable<number> = this.actionDataFor$("value", isNumber);
    const cmd$ = forEvery(this.titel$)(titel =>
      waarde$.pipe(
        collectOption(Transparantie.fromNumber),
        map(value => prt.ZetTransparantieVoorLaagCmd(titel, value, kaartLogOnlyWrapper)),
        sample(pasToeClick$)
      )
    );

    const sluit$ = rx.merge(
      this.zichtbaar$.pipe(
        filter(identity), // wel zichtbaar
        sample(geenAanpassing$) // en het signaal komt dat er geen aanpassing nodig meer is
      ),
      this.actionFor$("sluitTransparantieeditor")
    );

    this.nietToepassen$ = forEvery(laag$)(() =>
      rx.combineLatest(this.gezetteWaarde$, waarde$).pipe(
        map(([origineleWaarde, waarde]) => origineleWaarde === waarde),
        startWith(true)
      )
    );

    this.runInViewReady(
      rx.merge(
        sluit$.pipe(
          tap(() => {
            this.dispatch(prt.StopTransparantieBewerkingCmd());
          })
        ),
        cmd$.pipe(tap(cmd => this.dispatch(cmd)))
      )
    );
  }
}
