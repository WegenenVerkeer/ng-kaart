import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Function1 } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, share, shareReplay, switchMap } from "rxjs/operators";

import { KaartComponent } from "../../kaart/kaart.component";
import { collectOption } from "../../util";
import { GetraptZoekerDirective, ZoekerBoxComponent } from "../box/zoeker-box.component";
import { zoekerMetNaam } from "../zoeker";

import { AlleLagenZoekerService, CategorieObsProvider } from "./zoeker-alle-lagen.service";

const NIVEAU_ALLES = 0;
const NIVEAU_VANAF_BRON = 1;
const NIVEAU_VANAF_CATEGORIE = 2;

/**
 * Deze component leidt de gebruiker naar een lijst van lagen. Dit gebeurt adhv bronnen die optioneel categorieën
 * hebben.
 */
@Component({
  selector: "awv-zoeker-alle-lagen-getrapt",
  templateUrl: "./zoeker-alle-lagen-getrapt.component.html",
  styleUrls: ["./zoeker-alle-lagen-getrapt.component.scss"]
})
export class ZoekerAlleLagenGetraptComponent extends GetraptZoekerDirective implements OnInit, OnDestroy {
  readonly bronnen$: rx.Observable<string[]>;
  readonly hasCategorieen$: rx.Observable<boolean>;
  readonly categorieen$: rx.Observable<string[]>;

  bronControl = new FormControl({ value: "", disabled: false });
  categorieControl = new FormControl({ value: "", disabled: false });

  @Output()
  leegMakenDisabledChange: EventEmitter<Boolean> = new EventEmitter(true);

  constructor(kaartComponent: KaartComponent, zoekerComponent: ZoekerBoxComponent, zone: NgZone) {
    super(kaartComponent, zoekerComponent, zone);

    const services$: rx.Observable<Option<AlleLagenZoekerService>> = this.modelChanges.zoekerServices$.pipe(
      map(zoekerMetNaam("AlleLagen")),
      map(maybeZoeker => maybeZoeker as Option<AlleLagenZoekerService>)
    );

    this.bronnen$ = services$.pipe(
      switchMap(svcs =>
        svcs.foldL(
          () => rx.of([]), // Geen service betekent geen bronnen
          svc => svc.bronnen$
        )
      )
    );

    const gekozenBron$: rx.Observable<string> = this.bronControl.valueChanges.pipe(
      distinctUntilChanged(),
      filter(v => v !== null),
      share()
    );

    const svcsToCategorieenProvider: Function1<AlleLagenZoekerService, CategorieObsProvider> = svcs => svcs.categorie$Provider;

    const bronEnProvider$: rx.Observable<[string, CategorieObsProvider]> = services$.pipe(
      collectOption(s => s.map(svcsToCategorieenProvider)),
      switchMap(catProv => gekozenBron$.pipe(map(bron => [bron, catProv] as [string, CategorieObsProvider]))),
      shareReplay(1) // this.categorieen$ zit in een *ngIf
    );

    this.categorieen$ = bronEnProvider$.pipe(
      switchMap(([bron, subCatProv]) => subCatProv(bron).getOrElseL(() => rx.EMPTY)),
      share()
    );

    this.hasCategorieen$ = rx.combineLatest(
      bronEnProvider$.pipe(map(([bron, subCatProv]) => subCatProv(bron).isSome())),
      this.bronControl.valueChanges.pipe(
        distinctUntilChanged(),
        map(v => v !== null)
      ),
      (bronMetCategorie, nietLegeBron) => bronMetCategorie && nietLegeBron
    );

    const gekozenCategorie$: rx.Observable<string> = this.categorieControl.valueChanges.pipe(
      distinctUntilChanged(),
      filter(v => v !== null),
      share()
    );

    // Zorg ervoor dat de dropdown en resultaten leeggemaakt worden wanneer hogerop een nieuwe selectie gemaakt wordt
    this.bindToLifeCycle(gekozenBron$).subscribe(() => this.maakVeldenLeeg(NIVEAU_VANAF_CATEGORIE));

    // Afhankelijk of er categorieën zijn of niet, stop de selectie bij de bronControl of de categorieControl. Het
    // returntype is pure magie. De getrapte zoeker moet een object maken dat er net zo uit ziet als wat de zoekservice
    // in Geoloket2 verwacht. Dat type noemt daar AlleLagenZoekenInput, maar kunnen we vanuit ng-kaart niet refereren.
    const selectie$ = bronEnProvider$.pipe(
      switchMap(([bron, subCatProv]) =>
        subCatProv(bron).foldL(
          () => rx.of({ type: "AlleLagen", bron: bron, categorie: none }), //
          () => gekozenCategorie$.pipe(map(categorie => ({ type: "AlleLagen", bron: bron, categorie: some(categorie) })))
        )
      )
    );

    this.bindToLifeCycle(selectie$).subscribe(selectie => {
      this.leegMakenDisabledChange.emit(false);
      this.zoek(selectie, ["AlleLagen"]);
    });
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.maakVeldenLeeg(NIVEAU_ALLES);
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  maakVeldenLeeg(vanafNiveau: number) {
    switch (vanafNiveau) {
      case NIVEAU_VANAF_CATEGORIE:
        this.categorieControl.setValue(null);
        break;
      case NIVEAU_VANAF_BRON:
      case NIVEAU_ALLES:
        this.bronControl.setValue(null);
        this.categorieControl.setValue(null);
        break;
    }
    this.leegMakenDisabledChange.emit(true);
    super.maakVeldenLeeg(vanafNiveau);
  }
}
