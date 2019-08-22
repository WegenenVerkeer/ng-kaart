import { Component, Input, NgZone } from "@angular/core";
import { option } from "fp-ts";
import * as rx from "rxjs";
import { delay, map, share, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartComponent } from "../kaart.component";

import { laagToRows, NoSqlFsLaagAndData, Row } from "./model";

interface Header {
  readonly key: string; // om op te zoeken in een row
  readonly label: string; // voor weergave
}

@Component({
  selector: "awv-feature-tabel",
  templateUrl: "./feature-tabel-data.component.html",
  styleUrls: ["./feature-tabel-data.component.scss"]
})
export class FeatureTabelDataComponent extends KaartChildComponentBase {
  headers$: rx.Observable<Header[]>;
  rows$: rx.Observable<Row[]>;

  @Input()
  laag: NoSqlFsLaagAndData;

  constructor(kaart: KaartComponent, ngZone: NgZone) {
    super(kaart, ngZone);
    const laag$ = this.viewReady$.pipe(
      map(() => this.laag),
      share()
    ); // Input parameter maar beschikbaar na initialisatie
    this.headers$ = laag$.pipe(
      map(laag =>
        laag.veldInfos.map(vi => ({
          key: vi.naam,
          label: option.fromNullable(vi.label).getOrElse(vi.naam)
        }))
      ),
      share()
    );

    this.rows$ = laag$.pipe(
      delay(3000), // TODO moet beter -> event wanneer data geladen is
      map(laagToRows),
      tap(rows => console.log("****rows", rows))
    );
  }

  columnWidths(headers: Header[]) {
    console.log("****widths", headers.map(_ => "minmax(104px, 1fr)").join(" "));
    return headers.map(_ => "minmax(150px, 1fr)").join(" ");
  }
}
