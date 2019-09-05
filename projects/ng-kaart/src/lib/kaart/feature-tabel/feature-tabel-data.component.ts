import { ChangeDetectionStrategy, Component, Input, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { distinctUntilChanged, map, share, switchMap } from "rxjs/operators";

import { catOptions, collectOption, subSpy } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { Page, Row } from "./data-provider";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { ColumnHeaders, LaagModel, TableModel } from "./model";

@Component({
  selector: "awv-feature-tabel-data",
  templateUrl: "./feature-tabel-data.component.html",
  styleUrls: ["./feature-tabel-data.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelDataComponent extends KaartChildComponentBase {
  headers$: rx.Observable<ColumnHeaders>;
  rows$: rx.Observable<Row[]>;
  noDataAvailable$: rx.Observable<boolean>;
  dataAvailable$: rx.Observable<boolean>;

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
        map(LaagModel.headersLens.get),
        distinctUntilChanged(ColumnHeaders.setoidColumnHeaders.equals),
        share()
      )
    );

    const maybePage$ = laag$.pipe(
      map(LaagModel.pageLens.get),
      share()
    );
    const page$ = subSpy("****page$")(maybePage$.pipe(catOptions));

    this.rows$ = subSpy("****row$")(
      page$.pipe(
        map(Page.rowsLens.get),
        share()
      )
    );

    this.noDataAvailable$ = maybePage$.pipe(map(opt => opt.isNone()));
    this.dataAvailable$ = maybePage$.pipe(map(opt => opt.isSome()));
  }
}
