import { ChangeDetectionStrategy, Component, NgZone } from "@angular/core";
import { MatSliderChange } from "@angular/material";
import { option } from "fp-ts";
import { flow, Refinement } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { map, mapTo, share, switchMap, tap } from "rxjs/operators";
import { isNumber } from "util";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { Page } from "./data-provider";
import { FeatureTabelDataComponent } from "./feature-tabel-data.component";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { LaagModel, TableModel } from "./model";

export interface PagerData {
  readonly currentPageNumber: number;
  readonly lastPageNumber: number;
  readonly isFirstPage: boolean;
  readonly isLastPage: boolean;
  readonly doesNotHaveMultiplePages: boolean;
}

const filledMatSliderChange: Refinement<any, MatSliderChange> = (event): event is MatSliderChange =>
  event.hasOwnProperty("value") && Number.isInteger(event.value);

@Component({
  selector: "awv-feature-tabel-pager",
  templateUrl: "./feature-tabel-pager.component.html",
  styleUrls: ["./feature-tabel-pager.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelPagerComponent extends KaartChildComponentBase {
  public readonly pageData$: rx.Observable<PagerData | undefined>;

  constructor(kaart: KaartComponent, overzicht: FeatureTabelOverzichtComponent, laagData: FeatureTabelDataComponent, ngZone: NgZone) {
    super(kaart, ngZone);

    const laag$ = laagData.laag$;
    const maybePage$ = laag$.pipe(
      map(LaagModel.pageLens.get),
      share()
    );

    this.pageData$ = maybePage$.pipe(
      map(
        flow(
          option.map(page => {
            const currentPageNumber = Page.pageNumberLens.get(page);
            const lastPageNumber = Page.lastPageNumberLens.get(page);
            return {
              currentPageNumber: Page.getterPageNumber.get(currentPageNumber),
              lastPageNumber: Page.getterPageNumber.get(lastPageNumber),
              isFirstPage: Page.isFirst(currentPageNumber),
              isLastPage: Page.isTop(lastPageNumber)(currentPageNumber),
              doesNotHaveMultiplePages: Page.ordPageNumber.equals(Page.first, lastPageNumber)
            };
          }),
          option.toUndefined // Voor Angular
        )
      ),
      share()
    );

    const actions$ = laagData.laag$.pipe(
      switchMap(laag =>
        rx.merge(
          this.actionFor$("previous").pipe(mapTo(TableModel.previousPageUpdate(laag.titel))),
          this.actionFor$("next").pipe(mapTo(TableModel.nextPageUpdate(laag.titel))),
          this.actionDataFor$("setPageNumber", isNumber).pipe(map(TableModel.setPageNumberUpdate(laag.titel)))
        )
      )
    );

    this.runInViewReady(actions$.pipe(tap(overzicht.updater)));
  }

  public pageLabel(value: number): string {
    return (value + 1).toString();
  }
}
