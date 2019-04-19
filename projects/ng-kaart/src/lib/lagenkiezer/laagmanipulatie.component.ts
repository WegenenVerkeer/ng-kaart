import { AfterViewInit, ChangeDetectionStrategy, Component, Input, NgZone, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatMenuTrigger } from "@angular/material";
import * as array from "fp-ts/lib/Array";
import { Function1, Function2 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, sample, shareReplay, startWith, switchMap, tap } from "rxjs/operators";

import * as fltr from "../filter/filter-model";
import { FilterCql } from "../filter/filter-model";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
import { observeOnAngular } from "../util/observe-on-angular";
import { collectOption, subSpy } from "../util/operators";
import { atLeastOneTrue, negate } from "../util/thruth";

import { LagenkiezerComponent } from "./lagenkiezer.component";

const fetchFilterTotaal$: Function1<ke.ToegevoegdeVectorLaag, rx.Observable<string>> = laag => {
  return ke
    .asNosqlSource(laag.layer.getSource())
    .foldL(
      () => rx.of(""),
      source =>
        source
          .fetchCollectionSummary$()
          .pipe(switchMap(summary => (summary.count < 100000 ? source.fetchTotal$().pipe(map(num => `${num}`)) : rx.of(""))))
    );
};

@Component({
  selector: "awv-laagmanipulatie",
  templateUrl: "./laagmanipulatie.component.html",
  styleUrls: ["./laagmanipulatie.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LaagmanipulatieComponent extends KaartChildComponentBase implements OnInit {
  private readonly zoom$: rx.Observable<number>;
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly onzichtbaar$: rx.Observable<boolean>;
  readonly kanVerwijderen$: rx.Observable<boolean>;
  readonly kanFilteren$: rx.Observable<boolean>;
  readonly kanStijlAanpassen$: rx.Observable<boolean>;
  readonly minstensEenLaagActie$: rx.Observable<boolean>;
  readonly heeftFilter$: rx.Observable<boolean>;
  readonly heeftGeenFilter$: rx.Observable<boolean>;
  readonly filterActief$: rx.Observable<boolean>;
  readonly filterTotaal$: rx.Observable<string>;

  @Input()
  laag: ke.ToegevoegdeLaag;
  @Input()
  dragSource: boolean;
  @Input()
  dragTarget: boolean;
  @Input()
  dragUntargetable: boolean;
  @ViewChild(MatMenuTrigger)
  laagMenuTrigger: MatMenuTrigger;

  constructor(lagenkiezer: LagenkiezerComponent, kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);
    this.zoom$ = kaartComponent.modelChanges.viewinstellingen$.pipe(
      map(zi => zi.zoom),
      distinctUntilChanged(),
      observeOnAngular(zone)
    );
    this.zichtbaar$ = this.zoom$.pipe(
      map(zoom => zoom >= this.laag.bron.minZoom && zoom <= this.laag.bron.maxZoom),
      observeOnAngular(this.zone)
    );
    this.onzichtbaar$ = this.zichtbaar$.pipe(
      map(m => !m),
      shareReplay(1)
    );
    this.kanVerwijderen$ = lagenkiezer.opties$.pipe(
      map(o => o.verwijderbareLagen),
      shareReplay(1)
    );
    this.kanStijlAanpassen$ = lagenkiezer.opties$.pipe(
      map(o =>
        ke
          .asToegevoegdeVectorLaag(this.laag)
          .map(vlg => o.stijlbareVectorlagen(vlg.titel))
          .getOrElse(false)
      ),
      shareReplay(1)
    );
    this.kanFilteren$ = lagenkiezer.opties$.pipe(
      map(o =>
        ke
          .asToegevoegdeNosqlVectorLaag(this.laag)
          .map(() => o.filterbareLagen)
          .getOrElse(false)
      ),
      shareReplay(1)
    );

    const findLaagOpTitel: Function2<string, ke.ToegevoegdeLaag[], Option<ke.ToegevoegdeVectorLaag>> = (titel, lgn) =>
      array.findFirst(lgn, lg => lg.titel === titel).filter(ke.isToegevoegdeVectorLaag);

    const laag$ = this.modelChanges.lagenOpGroep.get("Voorgrond.Hoog")!.pipe(
      collectOption(lgn => findLaagOpTitel(this.laag.titel, lgn)),
      shareReplay(1)
    );

    this.heeftFilter$ = laag$.pipe(
      filter(laag => this.laag.titel === laag.titel),
      map(laag => fltr.isDefined(laag.filterInstellingen.spec)),
      startWith(false), // Er moet iets uit de observable komen of hidden wordt nooit gezet
      shareReplay(1)
    );

    this.heeftGeenFilter$ = this.heeftFilter$.pipe(map(negate));

    this.filterActief$ = laag$.pipe(
      filter(laag => this.laag.titel === laag.titel),
      map(laag => laag.filterInstellingen.actief),
      startWith(true),
      shareReplay(1)
    );

    // TODO: dit werkt niet omdat het dit laagmanipulatie object elke keer opnieuw aangemaakt wordt door de lagenkiezer (luisteren op
    //  lagenInGroep vernieuwd de array volledig) waardoor je de vorige state verliest. Fijnmaziger luisteren op laag aanpassingen?
    //  bvb volgen op Lagen.Hoog (e.d.) en daarbinnen filter op titel + distinctUntil op referentie + iets voorzien om te luisteren
    //  op laag veranderingen
    this.filterTotaal$ = subSpy("filterTotaal$")(
      this.modelChanges.lagenOpGroep.get("Voorgrond.Hoog")!.pipe(
        collectOption(lgn => findLaagOpTitel(this.laag.titel, lgn)),
        filter(laag => this.laag.titel === laag.titel),
        filter(laag => laag.filterInstellingen.actief && laag.filterInstellingen.spec !== fltr.pure()),
        distinctUntilChanged((p, q) => {
          console.log(FilterCql.cql(p.filterInstellingen.spec).toString());
          console.log(FilterCql.cql(q.filterInstellingen.spec).toString());
          return FilterCql.cql(p.filterInstellingen.spec).toString() === FilterCql.cql(q.filterInstellingen.spec).toString();
        }),
        debounceTime(500),
        switchMap(fetchFilterTotaal$)
      )
    );

    this.minstensEenLaagActie$ = rx
      .combineLatest(this.kanVerwijderen$, this.kanStijlAanpassen$, this.kanFilteren$, atLeastOneTrue)
      .pipe(shareReplay(1));

    const toggleFilterActief$ = this.actionFor$("toggleFilterActief");
    this.runInViewReady(
      this.filterActief$.pipe(
        sample(toggleFilterActief$),
        tap(actief => this.dispatch(cmd.ActiveerFilter(this.laag.titel, !actief, kaartLogOnlyWrapper)))
      )
    );
  }

  get title(): string {
    return this.laag.titel;
  }

  get gekozen(): boolean {
    return this.laag.magGetoondWorden;
  }

  get verwijderd(): boolean {
    return this.laag.bron.verwijderd;
  }

  get stijlInKiezer() {
    return this.laag.bron.verwijderd ? "verwijderd" : this.laag.stijlInLagenKiezer.getOrElse("");
  }

  toggleGekozen() {
    this.dispatch(
      this.laag.magGetoondWorden
        ? cmd.MaakLaagOnzichtbaarCmd(this.laag.titel, kaartLogOnlyWrapper)
        : cmd.MaakLaagZichtbaarCmd(this.laag.titel, kaartLogOnlyWrapper)
    );
  }

  get isLaagMenuOpen(): boolean {
    return this.laagMenuTrigger && this.laagMenuTrigger.menuOpen;
  }

  get isDragState(): boolean {
    return this.dragSource || this.dragTarget || this.dragUntargetable;
  }

  verwijder() {
    this.dispatch(cmd.VerwijderLaagCmd(this.laag.titel, kaartLogOnlyWrapper));
  }

  pasStijlAan() {
    this.dispatch(cmd.BewerkVectorlaagstijlCmd(this.laag as ke.ToegevoegdeVectorLaag));
  }

  pasFilterAan() {
    this.dispatch(cmd.BewerkVectorFilterCmd(this.laag as ke.ToegevoegdeVectorLaag));
  }

  verwijderFilter() {
    this.dispatch(cmd.ZetFilter(this.laag.titel, fltr.pure(), kaartLogOnlyWrapper));
  }
}
