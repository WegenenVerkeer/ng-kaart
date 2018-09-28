import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { FormControl } from "@angular/forms";
import { List, Set } from "immutable";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, switchMap } from "rxjs/operators";

import { KaartComponent } from "../../kaart/kaart.component";
import { GetraptZoekerComponent, ZoekerBoxComponent } from "../box/zoeker-box.component";

import { ExterneWmsZoekerService } from "./zoeker-externe-wms.service";

const NIVEAU_ALLES = 0;

@Component({
  selector: "awv-zoeker-externe-wms-getrapt",
  templateUrl: "./zoeker-externe-wms-getrapt.component.html",
  styleUrls: ["./zoeker-externe-wms-getrapt.component.scss"]
})
export class ZoekerExterneWmsGetraptComponent extends GetraptZoekerComponent implements OnInit, OnDestroy {
  readonly bronnen$: rx.Observable<Set<string>>;

  bronControl = new FormControl({ value: "", disabled: false });

  @Output() leegMakenDisabledChange: EventEmitter<Boolean> = new EventEmitter(true);

  constructor(kaartComponent: KaartComponent, zoekerComponent: ZoekerBoxComponent, zone: NgZone) {
    super(kaartComponent, zoekerComponent, zone);

    const services$: rx.Observable<List<ExterneWmsZoekerService>> = this.modelChanges.zoekerServices$.pipe(
      map(
        svcs =>
          svcs
            .filter(svc => svc!.naam() === "ExterneWms")
            .take(1)
            .toList() as List<ExterneWmsZoekerService>
      )
    );

    this.bronnen$ = services$.pipe(
      switchMap(
        svcs =>
          svcs.isEmpty()
            ? rx.of(Set()) // Geen service betekent geen bronnen
            : svcs.get(0).bronnen$ // We weten dat er juist 1 element is
      )
    );

    this.bindToLifeCycle(this.bronControl.valueChanges.pipe(distinctUntilChanged(), filter(v => v !== null))).subscribe(bron => {
      this.leegMakenDisabledChange.emit(false);
      this.zoek({ type: "ExterneWms", bron: bron }, Set.of("ExterneWms"));
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
    this.bronControl.setValue(null);
    this.leegMakenDisabledChange.emit(true);
    super.maakVeldenLeeg(vanafNiveau);
  }
}
