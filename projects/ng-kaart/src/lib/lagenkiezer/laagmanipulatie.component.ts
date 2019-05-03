import { ChangeDetectionStrategy, Component, Input, NgZone, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatIconRegistry, MatMenuTrigger } from "@angular/material";
import { DomSanitizer } from "@angular/platform-browser";
import * as array from "fp-ts/lib/Array";
import { Function2 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, sample, shareReplay, startWith, tap } from "rxjs/operators";

import { Filter as fltr } from "../filter/filter-model";
import { isTotaalOpgehaald } from "../filter/filter-totaal";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";
import { observeOnAngular } from "../util/observe-on-angular";
import { collectOption } from "../util/operators";
import { atLeastOneTrue, negate } from "../util/thruth";
import { encodeAsSvgUrl } from "../util/url";

import { LagenkiezerComponent } from "./lagenkiezer.component";

const spinnerSVG =
  // tslint:disable-next-line:max-line-length
  '<svg class="lds-spin" width="24px" height="24px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" style="background: none;"><g transform="translate(80,50)"> <g transform="rotate(0)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="1" transform="scale(1.06586 1.06586)"> <animateTransform attributeName="transform" type="scale" begin="-0.875s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="-0.875s"></animate> </circle> </g> </g><g transform="translate(71.21320343559643,71.21320343559643)"> <g transform="rotate(45)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="0.875" transform="scale(1.07836 1.07836)"> <animateTransform attributeName="transform" type="scale" begin="-0.75s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="-0.75s"></animate> </circle> </g> </g><g transform="translate(50,80)"> <g transform="rotate(90)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="0.75" transform="scale(1.09086 1.09086)"> <animateTransform attributeName="transform" type="scale" begin="-0.625s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="-0.625s"></animate> </circle> </g> </g><g transform="translate(28.786796564403577,71.21320343559643)"> <g transform="rotate(135)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="0.625" transform="scale(1.00336 1.00336)"> <animateTransform attributeName="transform" type="scale" begin="-0.5s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="-0.5s"></animate> </circle> </g> </g><g transform="translate(20,50.00000000000001)"> <g transform="rotate(180)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="0.5" transform="scale(1.01586 1.01586)"> <animateTransform attributeName="transform" type="scale" begin="-0.375s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="-0.375s"></animate> </circle> </g> </g><g transform="translate(28.78679656440357,28.786796564403577)"> <g transform="rotate(225)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="0.375" transform="scale(1.02836 1.02836)"> <animateTransform attributeName="transform" type="scale" begin="-0.25s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="-0.25s"></animate> </circle> </g> </g><g transform="translate(49.99999999999999,20)"> <g transform="rotate(270)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="0.25" transform="scale(1.04086 1.04086)"> <animateTransform attributeName="transform" type="scale" begin="-0.125s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="-0.125s"></animate> </circle> </g> </g><g transform="translate(71.21320343559643,28.78679656440357)"> <g transform="rotate(315)"> <circle cx="0" cy="0" r="8" fill="#000000" fill-opacity="0.125" transform="scale(1.05336 1.05336)"> <animateTransform attributeName="transform" type="scale" begin="0s" values="1.1 1.1;1 1" keyTimes="0;1" dur="1s" repeatCount="indefinite"></animateTransform> <animate attributeName="fill-opacity" keyTimes="0;1" dur="1s" repeatCount="indefinite" values="1;0" begin="0s"></animate> </circle> </g> </g></svg>';

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
  readonly filterTotaal$: rx.Observable<number>;
  readonly filterTotaalOnbekend$: rx.Observable<boolean>;
  readonly filterTotaalOpgehaald$: rx.Observable<boolean>;
  readonly filterTotaalOpTeHalen$: rx.Observable<boolean>;

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

  constructor(
    lagenkiezer: LagenkiezerComponent,
    kaartComponent: KaartComponent,
    zone: NgZone,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitize: DomSanitizer
  ) {
    super(kaartComponent, zone);

    this.matIconRegistry.addSvgIcon("spinner", this.domSanitize.bypassSecurityTrustResourceUrl(encodeAsSvgUrl(spinnerSVG)));

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
      map(laag => fltr.isDefined(laag.filterinstellingen.spec)),
      startWith(false), // Er moet iets uit de observable komen of hidden wordt nooit gezet
      shareReplay(1)
    );

    this.heeftGeenFilter$ = this.heeftFilter$.pipe(map(negate));

    this.filterActief$ = laag$.pipe(
      filter(laag => this.laag.titel === laag.titel),
      map(laag => laag.filterinstellingen.actief),
      startWith(true),
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
    this.filterTotaal$ = filterTotaalChanges$.pipe(
      filter(isTotaalOpgehaald),
      map(totaal => totaal.totaal)
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
