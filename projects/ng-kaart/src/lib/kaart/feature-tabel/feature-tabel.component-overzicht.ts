import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, Component, NgZone, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import * as rx from "rxjs";
import { map, share, switchMap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { NoSqlFsLaagAndData, TableModel } from "./model";

export const FeatureTabelUiSelector = "FeatureTabel";

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

    const model$: rx.Observable<TableModel> = this.viewReady$.pipe(
      switchMap(() =>
        this.modelChanges.lagenOpGroep["Voorgrond.Hoog"].pipe(
          // TODO distinctUntilChanged op titels? Verandering van volgorde nodig?
          map(TableModel),
          share()
        )
      )
    );

    this.lagen$ = model$.pipe(map(model => model.laagData));
  }

  public onTitelChanged(titel: string) {
    console.log("titel", titel);
  }
}
