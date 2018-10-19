import { ChangeDetectionStrategy, Component, Input, NgZone, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatMenuTrigger } from "@angular/material";
import * as rx from "rxjs";
import { distinctUntilChanged, map, mapTo, share, shareReplay, startWith, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { asToegevoegdeVectorLaag, ToegevoegdeLaag, ToegevoegdeVectorLaag } from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
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
  readonly kanStijlAanpassen$: rx.Observable<boolean>;
  readonly minstensEenLaagActie$: rx.Observable<boolean>;

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
      tap(v => console.log("****vwl1", v)),
      shareReplay(1)
    );
    this.kanStijlAanpassen$ = lagenkiezer.opties$.pipe(
      tap(o => console.log("****ksao", o, o.stijlbareVectorlagen(this.laag.titel))),
      map(o =>
        asToegevoegdeVectorLaag(this.laag)
          .map(vlg => o.stijlbareVectorlagen(vlg.titel))
          .getOrElse(false)
      ),
      shareReplay(1)
    );
    this.minstensEenLaagActie$ = rx.combineLatest(this.kanVerwijderen$, this.kanStijlAanpassen$, (v, a) => v || a).pipe(shareReplay(1));

    // this.clickFor$("verwijderLaag").subscribe(() => this.dispatch(cmd.VerwijderLaagCmd(this.laag.titel, kaartLogOnlyWrapper)));
    // this.clickFor$("pasStijlAan").subscribe(() => console.log("****stijl aanpassen"));
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
}
