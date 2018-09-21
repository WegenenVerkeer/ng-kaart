import { Component, NgZone, OnInit } from "@angular/core";
import { Predicate } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { combineLatest, debounceTime, delay, distinctUntilChanged, map, mapTo, merge } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export const ZoomknoppenUiSelector = "Zoomknoppen";

@Component({
  selector: "awv-kaart-zoom",
  templateUrl: "./kaart-zoom.component.html",
  styleUrls: ["./kaart-zoom.component.scss"]
})
export class KaartZoomComponent extends KaartChildComponentBase implements OnInit {
  readonly zoomClickedSubj: rx.Subject<number> = new rx.Subject<number>();
  readonly canZoomIn$: rx.Observable<boolean>;
  readonly canZoomOut$: rx.Observable<boolean>;
  readonly zoom$: rx.Observable<number>;

  constructor(private readonly parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    const viewinstellingen$ = this.parent.modelChanges.viewinstellingen$;

    this.zoom$ = viewinstellingen$.pipe(
      distinctUntilChanged((vi1, vi2) => vi1.zoom === vi2.zoom && vi1.minZoom === vi2.minZoom && vi1.maxZoom === vi2.maxZoom),
      map(vi => vi.zoom)
    );
    this.canZoomIn$ = this.canZoom(viewinstellingen$, vi => vi.zoom < vi.maxZoom);
    this.canZoomOut$ = this.canZoom(viewinstellingen$, vi => vi.zoom > vi.minZoom);
    this.bindToLifeCycle(this.zoomClickedSubj).subscribe(zoom => this.dispatch(prt.VeranderZoomCmd(zoom, kaartLogOnlyWrapper)));
  }

  zoomTo(zoom: number) {
    this.zoomClickedSubj.next(zoom);
  }

  private canZoom(viewinstellingen$: rx.Observable<prt.Viewinstellingen>, cmp: Predicate<prt.Viewinstellingen>) {
    return this.zoomClickedSubj.pipe(
      // onmiddelijk na de klik wordt de button disabled
      mapTo(false),
      // om dan enabled te worden wanneer de zoom aangepast is als we nog niet te ver gezoomd hebben tenminste
      merge(viewinstellingen$.pipe(map(cmp))),
      // Er is een onwaarschijnlijke raceconditie tussen een onwaarschijnlijke 2de klik en het disablen.
      // Het zou het kunnen dat de 2de klik komt na het opvangen van het nieuwe zoomniveau. In dat geval zou de knop disabled blijven.
      // Daarom kijken we na een tijdje nog eens naar de zoom.
      merge(this.zoomClickedSubj.pipe(delay(750), combineLatest(viewinstellingen$, (_, vi) => cmp(vi))))
    );
  }
}
