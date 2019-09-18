import { ChangeDetectionStrategy, Component, Input, NgZone, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";
import { Option } from "fp-ts/lib/Option";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { SortDirection } from "./data-provider";

@Component({
  selector: "awv-feature-tabel-sortering-status",
  template: "<mat-icon *ngIf='down'>arrow_downward</mat-icon><mat-icon *ngIf='up'>arrow_upward</mat-icon>",
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureTabelSorteringStatusComponent extends KaartChildComponentBase {
  public up: boolean;
  public down: boolean;

  @Input()
  public set sortering(value: Option<SortDirection>) {
    this.up = option.exists(direction => direction === "ASCENDING")(value);
    this.down = option.exists(direction => direction === "DESCENDING")(value);
  }

  constructor(kaart: KaartComponent, ngZone: NgZone) {
    super(kaart, ngZone);
  }
}
