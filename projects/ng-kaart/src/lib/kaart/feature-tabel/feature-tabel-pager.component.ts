import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone } from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";
import { map, mapTo, share, switchMap, tap } from "rxjs/operators";

import { isNumber } from "../../util/number";
import { KaartChildDirective } from "../kaart-child.directive";
import { KaartComponent } from "../kaart.component";

import { Page } from "./data-provider";
import { FeatureTabelDataComponent } from "./feature-tabel-data.component";
import { FeatureTabelOverzichtComponent } from "./feature-tabel-overzicht.component";
import { LaagModel } from "./laag-model";

export interface PagerData {
  readonly currentPageNumber: number;
  readonly lastPageNumber: number;
  readonly isFirstPage: boolean;
  readonly isLastPage: boolean;
  readonly doesNotHaveMultiplePages: boolean;
}

@Component({
  selector: "awv-feature-tabel-pager",
  templateUrl: "./feature-tabel-pager.component.html",
  styleUrls: ["./feature-tabel-pager.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelPagerComponent extends KaartChildDirective {
  public readonly pageData$: rx.Observable<PagerData | undefined>;

  constructor(
    kaart: KaartComponent,
    overzicht: FeatureTabelOverzichtComponent,
    laagData: FeatureTabelDataComponent,
    ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    super(kaart, ngZone);

    const laag$ = laagData.laag$;

    this.pageData$ = laag$.pipe(
      map(laag =>
        pipe(
          LaagModel.pageNumberFold.headOption(laag),
          option.chain(currentPageNumber =>
            pipe(
              LaagModel.lastPageNumberFold.headOption(laag),
              option.map(lastPageNumber => ({
                currentPageNumber: Page.getterPageNumber.get(currentPageNumber),
                lastPageNumber: Page.getterPageNumber.get(lastPageNumber),
                isFirstPage: Page.isFirst(currentPageNumber),
                isLastPage: Page.isTop(lastPageNumber)(currentPageNumber),
                doesNotHaveMultiplePages: Page.ordPageNumber.equals(Page.first, lastPageNumber)
              }))
            )
          ),
          option.toUndefined
        )
      ),
      tap(() => this.cdr.markForCheck()),
      share()
    );

    const actions$ = rx.merge(
      this.actionFor$("previous").pipe(mapTo(LaagModel.previousPageUpdate)),
      this.actionFor$("next").pipe(mapTo(LaagModel.nextPageUpdate)),
      this.actionDataFor$("setPageNumber", isNumber).pipe(map(LaagModel.setPageNumberUpdate))
    );

    this.runInViewReady(laag$.pipe(switchMap(laag => actions$.pipe(tap(overzicht.laagUpdater(laag.titel))))));
  }

  public pageLabel(value: number): string {
    return (value + 1).toString();
  }
}
