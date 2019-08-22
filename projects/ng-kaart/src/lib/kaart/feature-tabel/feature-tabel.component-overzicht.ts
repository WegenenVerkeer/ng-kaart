import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import { Function2 } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, share, switchMap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";

import { NoSqlFsLaagAndData, TableModel } from "./model";

export const FeatureTabelUiSelector = "FeatureTabel";

const laagMagZichtbaarZijn: Function2<ke.ToegevoegdeLaag, number, boolean> = (laag, zoom) =>
  zoom >= laag.bron.minZoom && zoom <= laag.bron.maxZoom;

@Component({
  selector: "awv-feature-tabel-overzicht",
  templateUrl: "./feature-tabel-overzicht.component.html",
  styleUrls: ["./feature-tabel-overzicht.component.scss"],
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 1, "max-height": "400px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "400px" }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush // Omdat angular anders veel te veel change detection uitvoert
})
export class FeatureTabelOverzichtComponent extends KaartChildComponentBase {
  public zichtbaar$: rx.Observable<boolean> = rx.of(true);
  public lagen$: rx.Observable<NoSqlFsLaagAndData[]>;

  constructor(kaart: KaartComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    const zoom$ = kaart.modelChanges.viewinstellingen$.pipe(
      map(i => i.zoom),
      distinctUntilChanged()
    );

    const voorgrondLagen$ = kaart.modelChanges.lagenOpGroep["Voorgrond.Hoog"];

    const model$: rx.Observable<TableModel> = this.viewReady$.pipe(
      switchMap(() =>
        voorgrondLagen$.pipe(
          switchMap(lagen =>
            zoom$.pipe(
              // TODO distinctUntilChanged op titels? Verandering van volgorde nodig?
              map(zoom => lagen.filter(laag => laag.magGetoondWorden && laagMagZichtbaarZijn(laag, zoom))),
              map(TableModel),
              share()
            )
          )
        )
      )
    );

    this.lagen$ = model$.pipe(map(model => model.laagData));
  }

  public onTitelChanged(titel: string) {
    console.log("titel", titel);
  }
}
