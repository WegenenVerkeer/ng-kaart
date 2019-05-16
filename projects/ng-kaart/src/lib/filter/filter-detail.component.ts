import { Component, Input, NgZone } from "@angular/core";
import { Function1 } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { filter, map, sample, share, shareReplay, switchMap, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
import { collectOption, subSpy } from "../util/operators";

import { Filter as fltr } from "./filter-model";
import { isTotaalOpgehaald } from "./filter-totaal";

@Component({
  selector: "awv-filter-detail",
  templateUrl: "./filter-detail.component.html",
  styleUrls: ["./filter-detail.component.scss"]
})
export class FilterDetailComponent extends KaartChildComponentBase {
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

    // We krijgen de laag binnen telkens als ze verandert, maar we moeten er nog wel voor zorgen dat de observable
    // blijft leven.
    const laag$ = this.viewReady$.pipe(
      switchMap(() => rx.merge(rx.of(this.laag), rx.never())),
      shareReplay(1)
    );

    const expressionFilter$ = laag$.pipe(
      collectOption(laag => fltr.asExpressionFilter(laag.filterinstellingen.spec)),
      share()
    );

    this.expression$ = expressionFilter$.pipe(
      // TODO gebruik de onderstaande lijn ipv de fixed expressie
      // map(expressionFilter => expressionFilter.expression),
      map(() =>
        fltr.Disjunction(
          fltr.Conjunction(
            fltr.Conjunction(
              fltr.BinaryComparison("equality", fltr.Property("string", "naam", "naam"), fltr.Literal("string", "mijn naam")),
              fltr.BinaryComparison("contains", fltr.Property("string", "ident8", "ident8"), fltr.Literal("string", "N008"))
            ),
            fltr.BinaryComparison("equality", fltr.Property("string", "zijde rijweg", "zijde rijweg"), fltr.Literal("string", "Links"))
          ),
          fltr.Conjunction(
            fltr.BinaryComparison("largerOrEqual", fltr.Property("integer", "lengte", "lengte"), fltr.Literal("integer", 10)),
            fltr.BinaryComparison("smallerOrEqual", fltr.Property("integer", "breedte", "breedte"), fltr.Literal("integer", 1000))
          )
        )
      ),
      share()
    );

    this.omschrijving$ = expressionFilter$.pipe(
      collectOption(expressionFilter => expressionFilter.name),
      share()
    );

    // TODO hiervoor moeten we op de updates aan de laag luisteren
    const filterTotaalChanges$ = laag$.pipe(
      map(laag => laag.filterinstellingen.totaal),
      share()
    );

    this.filterActief$ = laag$.pipe(map(laag => laag.filterinstellingen.actief));

    this.filterTotaalOnbekend$ = filterTotaalChanges$.pipe(map(filterTotaal => filterTotaal.type === "TeVeelData"));
    this.filterTotaalOpTeHalen$ = filterTotaalChanges$.pipe(map(filterTotaal => filterTotaal.type === "TotaalOpTeHalen"));
    this.filterTotaalOpgehaald$ = filterTotaalChanges$.pipe(map(filterTotaal => filterTotaal.type === "TotaalOpgehaald"));
    this.filterTotaalOphalenMislukt$ = filterTotaalChanges$.pipe(map(filterTotaal => filterTotaal.type === "TotaalOphalenMislukt"));
    this.filterTotalen$ = filterTotaalChanges$.pipe(
      filter(isTotaalOpgehaald),
      map(totaal => `${totaal.totaal}/${totaal.collectionTotaal}`)
    );

    const actionOnLaag$: <A>(action: string, f: Function1<ke.ToegevoegdeVectorLaag, A>) => rx.Observable<A> = (action, f) =>
      rx.combineLatest(laag$, this.actionFor$(action)).pipe(map(([laag]) => f(laag)));

    const cmnds$ = rx.merge(
      actionOnLaag$("toggleFilterActief", laag => cmd.ActiveerFilter(laag.titel, !laag.filterinstellingen.actief, kaartLogOnlyWrapper)),
      actionOnLaag$("pasFilterAan", laag => cmd.BewerkVectorFilterCmd(laag)),
      actionOnLaag$("verwijderFilter", laag => cmd.ZetFilter(laag.titel, fltr.empty(), kaartLogOnlyWrapper))
    );
    this.bindToLifeCycle(cmnds$).subscribe(cmnd => this.dispatch(cmnd));
  }
}
