import { ChangeDetectionStrategy, Component, ElementRef, NgZone, QueryList, ViewChildren, ViewEncapsulation } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { Curried2, Function1, Function2, identity, Predicate, Refinement, tuple } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import * as rx from "rxjs";
import { filter, map, sample, shareReplay, switchMap, tap } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import * as prt from "../kaart/kaart-protocol";
import { KaartComponent } from "../kaart/kaart.component";
import { collectOption, forEvery, subSpy } from "../util/operators";

import { isAanpassingBezig, isAanpassingNietBezig, TransparantieaanpassingBezig, TransparantieaanpassingState } from "./state";

@Component({
  selector: "awv-transparantieeditor",
  templateUrl: "./transparantieeditor.component.html",
  styleUrls: ["./transparantieeditor.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransparantieeditorComponent extends KaartChildComponentBase {
  readonly zichtbaar$: rx.Observable<boolean>;
  readonly titel$: rx.Observable<string>;
  readonly nietToepassen$: rx.Observable<boolean>;

  @ViewChildren("editor")
  editorElement: QueryList<ElementRef>; // QueryList omdat enkel beschikbaar wanneer ngIf true is

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    const editorElement$ = this.viewReady$.pipe(
      switchMap(() => this.editorElement.changes),
      filter(ql => ql.length > 0),
      map(ql => ql.first.nativeElement)
    );

    const aanpassing$: rx.Observable<TransparantieaanpassingBezig> = subSpy("***aanpassing$")(
      kaart.modelChanges.transparantieaanpassingState$.pipe(
        filter(isAanpassingBezig),
        shareReplay(1) // Alle observables die later subscriben (en er zijn er veel) moeten de huidige toestand kennen.
      )
    );
    const geenAanpassing$ = kaart.modelChanges.transparantieaanpassingState$.pipe(filter(isAanpassingNietBezig));

    this.zichtbaar$ = kaart.modelChanges.transparantieaanpassingState$.pipe(map(isAanpassingBezig));

    const laag$: rx.Observable<ke.ToegevoegdeLaag> = aanpassing$.pipe(
      // TODO ook luisteren op veranderingen in de lagen.
      map(aanpassing => aanpassing.laag),
      shareReplay(1) // De huidige laag moet bewaard blijven voor alle volgende subscribers
    );
    this.titel$ = laag$.pipe(map(laag => laag.titel));

    const sluit$ = rx.merge(
      this.zichtbaar$.pipe(
        filter(identity), // wel zichtbaar
        sample(geenAanpassing$) // en het signaal komt dat er geen aanpassing nodig meer is
      ),
      this.actionFor$("sluitTransparantieeditor"),
      this.actionFor$("annuleerTransparantie") // TODO wijzingen ongedaan maken
    );

    this.nietToepassen$ = rx.of(false); // TODO kijken of er iets gewijzigd is.

    this.runInViewReady(
      rx.merge(
        laag$.pipe(tap(laag => console.log("****laag", laag))),
        sluit$.pipe(
          tap(() => {
            this.dispatch(prt.StopTransparantieBewerkingCmd());
          })
        )
      )
    );
  }
}
