import { Component, Input, NgZone } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { Function2 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { filter, map, sample, shareReplay, startWith, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
import { collectOption } from "../util/operators";

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

  get filter(): fltr.ExpressionFilter {
    return <fltr.ExpressionFilter>this.laag.filterinstellingen.spec;
  }

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    const findLaagOpTitel: Function2<string, ke.ToegevoegdeLaag[], Option<ke.ToegevoegdeVectorLaag>> = (titel, lgn) =>
      array.findFirst(lgn, lg => lg.titel === titel).filter(ke.isToegevoegdeVectorLaag);

    const laag$ = this.modelChanges.lagenOpGroep.get("Voorgrond.Hoog")!.pipe(
      collectOption(lgn => findLaagOpTitel(this.laag.titel, lgn)),
      shareReplay(1)
    );

    const filterTotaalChanges$ = laag$.pipe(
      filter(laag => this.laag.titel === laag.titel),
      map(laag => laag.filterinstellingen.totaal),
      shareReplay(1)
    );

    this.filterTotaalOnbekend$ = filterTotaalChanges$.pipe(map(filterTotaal => filterTotaal.type === "TeVeelData"));
    this.filterTotaalOpTeHalen$ = filterTotaalChanges$.pipe(map(filterTotaal => filterTotaal.type === "TotaalOpTeHalen"));
    this.filterTotaalOpgehaald$ = filterTotaalChanges$.pipe(map(filterTotaal => filterTotaal.type === "TotaalOpgehaald"));
    this.filterTotalen$ = filterTotaalChanges$.pipe(
      filter(isTotaalOpgehaald),
      map(totaal => `${totaal.totaal}/${totaal.collectionTotaal}`)
    );

    this.filterActief$ = laag$.pipe(
      filter(laag => this.laag.titel === laag.titel),
      map(laag => laag.filterinstellingen.actief),
      startWith(true),
      shareReplay(1)
    );

    const toggleFilterActief$ = this.actionFor$("toggleFilterActief");
    this.runInViewReady(
      this.filterActief$.pipe(
        sample(toggleFilterActief$),
        tap(actief => this.dispatch(cmd.ActiveerFilter(this.laag.titel, !actief, kaartLogOnlyWrapper)))
      )
    );
  }

  omschrijving(): string | undefined {
    return this.filter.name.toUndefined();
  }

  verwijderFilter() {
    this.dispatch(cmd.ZetFilter(this.laag.titel, fltr.pure(), kaartLogOnlyWrapper));
  }

  pasFilterAan() {
    this.dispatch(cmd.BewerkVectorFilterCmd(this.laag as ke.ToegevoegdeVectorLaag));
  }
}
