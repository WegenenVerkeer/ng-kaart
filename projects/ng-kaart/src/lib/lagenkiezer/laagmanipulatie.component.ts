import { ChangeDetectionStrategy, Component, Input, NgZone, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatDialog, MatMenuTrigger } from "@angular/material";
import { fromNullable, none } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { BehaviorSubject } from "rxjs";
import { distinctUntilChanged, map, shareReplay, startWith } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { asToegevoegdeNosqlVectorLaag, asToegevoegdeVectorLaag, ToegevoegdeLaag, ToegevoegdeVectorLaag } from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
import { nonEmptyString } from "../util";
import { observeOnAngular } from "../util/observe-on-angular";

import { LagenkiezerComponent } from "./lagenkiezer.component";

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

  // TODO: subject moet luisteren op messages. Zit in volgende story
  readonly filterActiefSubj: rx.BehaviorSubject<boolean> = new rx.BehaviorSubject<boolean>(true);
  readonly filterActief$: rx.Observable<boolean> = this.filterActiefSubj.asObservable();

  // TODO: moet 1 maal opgehaald worden uit featureserver
  readonly filterTotaalSubj: rx.BehaviorSubject<number> = new rx.BehaviorSubject<number>(999);
  readonly filterTotaal$: rx.Observable<number> = this.filterTotaalSubj.asObservable();

  @Input()
  laag: ToegevoegdeLaag;
  @Input()
  dragSource: boolean;
  @Input()
  dragTarget: boolean;
  @Input()
  dragUntargetable: boolean;
  @ViewChild(MatMenuTrigger)
  laagMenuTrigger: MatMenuTrigger;

  filterActief = true;

  constructor(lagenkiezer: LagenkiezerComponent, kaartComponent: KaartComponent, zone: NgZone, private readonly dialog: MatDialog) {
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
        asToegevoegdeVectorLaag(this.laag)
          .map(vlg => o.stijlbareVectorlagen(vlg.titel))
          .getOrElse(false)
      ),
      shareReplay(1)
    );
    this.kanFilteren$ = lagenkiezer.opties$.pipe(
      map(o =>
        asToegevoegdeNosqlVectorLaag(this.laag)
          .map(vlg => o.filterbareLagen)
          .getOrElse(false)
      ),
      shareReplay(1)
    );
    this.heeftFilter$ = kaartComponent.modelChanges.laagFilterGezet$.pipe(
      map(filterGezet => this.laag.titel === filterGezet.laag.titel && filterGezet.filter.isSome()),
      shareReplay(1)
    );
    this.minstensEenLaagActie$ = rx.combineLatest(this.kanVerwijderen$, this.kanStijlAanpassen$, (v, a) => v || a).pipe(shareReplay(1));
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
    this.dispatch(cmd.BewerkVectorlaagstijlCmd(this.laag as ToegevoegdeVectorLaag));
  }

  pasFilterAan() {
    this.dispatch(cmd.BewerkVectorFilterCmd(this.laag as ToegevoegdeVectorLaag));
  }

  verwijderFilter() {
    this.dispatch(cmd.ZetFilter(this.laag.titel, none, kaartLogOnlyWrapper));
  }

  toggleFilter() {
    // TODO: dit moet met messages, want moet doorstromen naar reducer. Zit in volgende story
    this.filterActiefSubj.next(!this.filterActiefSubj.value);
  }
}
