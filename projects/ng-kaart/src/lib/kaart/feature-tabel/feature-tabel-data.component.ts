import { ChangeDetectionStrategy, Component, Input, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { map, share, switchMap } from "rxjs/operators";

import { collectOption, subSpy } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { ColumnHeaders, Row, TableModel } from "./model";

@Component({
  selector: "awv-feature-tabel",
  templateUrl: "./feature-tabel-data.component.html",
  styleUrls: ["./feature-tabel-data.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelDataComponent extends KaartChildComponentBase {
  headers$: rx.Observable<ColumnHeaders>;
  rows$: rx.Observable<Row[]>;

  @Input()
  laagTitel: string;

  constructor(kaart: KaartComponent, overzicht: FeatureTabelOverzichtComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    const model$ = overzicht.model$;

    const laag$ = subSpy("****laag$")(
      this.viewReady$.pipe(
        // De input is pas beschikbaar nadat de view klaar is
        switchMap(() =>
          model$.pipe(
            collectOption(TableModel.laagForTitel(this.laagTitel)),
            share()
          )
        )
      )
    );

    this.headers$ = subSpy("****headers$")(
      laag$.pipe(
        map(laag => laag.headers),
        share()
      )
    );

    const page$ = subSpy("****page$")(
      laag$.pipe(
        collectOption(laag => laag.page),
        share()
      )
    );

    this.rows$ = subSpy("****row$")(
      page$.pipe(
        map(page => page.rows),
        share()
      )
    );
  }
}
