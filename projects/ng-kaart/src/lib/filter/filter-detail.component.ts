import { Component, Input, NgZone } from "@angular/core";
import { array, option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";
import { filter, map, share, shareReplay, switchMap } from "rxjs/operators";

import { KaartChildDirective } from "../kaart/kaart-child.directive";
import * as ke from "../kaart/kaart-elementen";
import {
  KaartInternalMsg,
  kaartLogOnlyWrapper,
} from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
import { collectOption } from "../util/operators";

import { Filter as fltr } from "./filter-model";
import * as FilterTotaal from "./filter-totaal";

@Component({
  selector: "awv-filter-detail",
  templateUrl: "./filter-detail.component.html",
  styleUrls: ["./filter-detail.component.scss"],
})
export class FilterDetailComponent extends KaartChildDirective {
  @Input()
  laag: ke.ToegevoegdeVectorLaag;

  readonly filterActief$: rx.Observable<boolean>;
  readonly filterTotalen$: rx.Observable<string>;
  readonly filterTotaalOnbekend$: rx.Observable<boolean>;
  readonly filterTotaalOpgehaald$: rx.Observable<boolean>;
  readonly filterTotaalOpTeHalen$: rx.Observable<boolean>;
  readonly filterTotaalOphalenMislukt$: rx.Observable<boolean>;
  readonly omschrijving$: rx.Observable<string>;
  readonly expression$: rx.Observable<fltr.Expression>;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    const laag$ = this.viewReady$.pipe(
      switchMap(() => rx.merge(rx.of(this.laag), rx.never())),
      shareReplay(1)
    );

    const expressionFilter$ = laag$.pipe(
      collectOption((laag) =>
        fltr.asExpressionFilter(laag.filterinstellingen.spec)
      ),
      share()
    );

    this.expression$ = expressionFilter$.pipe(
      map((expressionFilter) => expressionFilter.expression),
      // map(() =>
      //   fltr.Disjunction(
      //     fltr.Conjunction(
      //       fltr.BinaryComparison("equality", fltr.Property("string", "naam", "Naam"), fltr.Literal("string", "mijn naam")),
      //       fltr.BinaryComparison("equality", fltr.Property("string", "zijde rijweg", "Zijde rijweg"), fltr.Literal("string", "Links"))
      //     ),
      //     fltr.Conjunction(
      //       fltr.BinaryComparison("largerOrEqual", fltr.Property("integer", "lengte", "Lengte"), fltr.Literal("integer", 10)),
      //       fltr.BinaryComparison("smallerOrEqual", fltr.Property("integer", "breedte", "Breedte"), fltr.Literal("integer", 1000))
      //     )
      //   )
      // ),
      share()
    );

    this.omschrijving$ = expressionFilter$.pipe(
      collectOption((expressionFilter) => expressionFilter.name),
      share()
    );

    const findLaagOpTitel: (
      titel: string,
      lgn: ke.ToegevoegdeLaag[]
    ) => option.Option<ke.ToegevoegdeVectorLaag> = (titel, lgn) =>
      pipe(
        lgn,
        array.findFirst((lg) => lg.titel === titel),
        option.filter(ke.isToegevoegdeVectorLaag)
      );

    const laagUpdates$ = laag$.pipe(
      switchMap((laag) =>
        this.modelChanges.lagenOpGroep["Voorgrond.Hoog"].pipe(
          collectOption((lgn) => findLaagOpTitel(laag.titel, lgn)),
          shareReplay(1)
        )
      )
    );

    const filterTotaalChanges$ = laagUpdates$.pipe(
      map((laag) => laag.filterinstellingen.totaal),
      shareReplay(1)
    );

    this.filterActief$ = laagUpdates$.pipe(
      map((laag) => laag.filterinstellingen.actief)
    );

    this.filterTotaalOnbekend$ = filterTotaalChanges$.pipe(
      map(FilterTotaal.isTeVeelData)
    );
    this.filterTotaalOpTeHalen$ = filterTotaalChanges$.pipe(
      map(FilterTotaal.isTotaalOpTeHalen)
    );
    this.filterTotaalOpgehaald$ = filterTotaalChanges$.pipe(
      map(FilterTotaal.isTotaalOpgehaald)
    );
    this.filterTotaalOphalenMislukt$ = filterTotaalChanges$.pipe(
      map(FilterTotaal.isTotaalMislukt)
    );
    this.filterTotalen$ = filterTotaalChanges$.pipe(
      filter(FilterTotaal.isTotaalOpgehaald),
      map((totaal) => `${totaal.totaal}/${totaal.collectionTotaal}`),
      shareReplay(1)
    );

    const actionOnLaag$: <A>(
      action: string,
      f: (arg: ke.ToegevoegdeVectorLaag) => A
    ) => rx.Observable<A> = (action, f) =>
      rx
        .combineLatest(laag$, this.actionFor$(action))
        .pipe(map(([laag]) => f(laag)));

    const cmnds$ = rx.merge(
      actionOnLaag$<cmd.Command<KaartInternalMsg>[]>(
        "toggleFilterActief",
        (laag) => {
          return !laag.filterinstellingen.actief // als de filter actief wordt, maak dan ook de laag zichtbaar
            ? [
                cmd.ActiveerFilter(
                  laag.titel,
                  !laag.filterinstellingen.actief,
                  kaartLogOnlyWrapper
                ),
                cmd.MaakLaagZichtbaarCmd(this.laag.titel, kaartLogOnlyWrapper),
              ]
            : [
                cmd.ActiveerFilter(
                  laag.titel,
                  !laag.filterinstellingen.actief,
                  kaartLogOnlyWrapper
                ),
              ];
        }
      ),
      actionOnLaag$<cmd.Command<KaartInternalMsg>[]>("pasFilterAan", (laag) => [
        cmd.BewerkVectorFilterCmd(laag),
      ]),
      actionOnLaag$<cmd.Command<KaartInternalMsg>[]>(
        "verwijderFilter",
        (laag) => [cmd.ZetFilter(laag.titel, fltr.empty(), kaartLogOnlyWrapper)]
      )
    );
    this.bindToLifeCycle(cmnds$).subscribe((cmnds) =>
      cmnds.map((msg) => this.dispatch(msg))
    );
  }
}
