import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Option } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, switchMap } from "rxjs/operators";

import { KaartComponent } from "../../kaart/kaart.component";
import { GetraptZoekerComponent, ZoekerBoxComponent } from "../box/zoeker-box.component";
import { zoekerMetNaam } from "../zoeker";

import { AlleLagenZoekerService } from "./zoeker-alle-lagen.service";

const NIVEAU_ALLES = 0;

@Component({
  selector: "awv-zoeker-alle-lagen-getrapt",
  templateUrl: "./zoeker-alle-lagen-getrapt.component.html",
  styleUrls: ["./zoeker-alle-lagen-getrapt.component.scss"]
})
export class ZoekerAlleLagenGetraptComponent extends GetraptZoekerComponent implements OnInit, OnDestroy {
  readonly categorieen$: rx.Observable<string[]>;

  categorieControl = new FormControl({ value: "", disabled: false });

  @Output()
  leegMakenDisabledChange: EventEmitter<Boolean> = new EventEmitter(true);

  constructor(kaartComponent: KaartComponent, zoekerComponent: ZoekerBoxComponent, zone: NgZone) {
    super(kaartComponent, zoekerComponent, zone);

    const services$: rx.Observable<Option<AlleLagenZoekerService>> = this.modelChanges.zoekerServices$.pipe(
      map(zoekerMetNaam("AlleLagen")),
      map(maybeZoeker => maybeZoeker as Option<AlleLagenZoekerService>)
    );

    this.categorieen$ = services$.pipe(
      switchMap(svcs =>
        svcs.foldL(
          () => rx.of([]), // Geen service betekent geen categorieën
          svc => svc.categorieen$
        )
      )
    );

    this.bindToLifeCycle(
      this.categorieControl.valueChanges.pipe(
        distinctUntilChanged(),
        filter(v => v !== null)
      )
    ).subscribe(categorie => {
      this.leegMakenDisabledChange.emit(false);
      this.zoek({ type: "AlleLagen", categorie: categorie }, ["AlleLagen"]);
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
    this.categorieControl.setValue(null);
    this.leegMakenDisabledChange.emit(true);
    super.maakVeldenLeeg(vanafNiveau);
  }
}
