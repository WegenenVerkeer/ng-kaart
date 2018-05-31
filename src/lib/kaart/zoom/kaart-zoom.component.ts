import { Component, NgZone, OnInit } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { distinctUntilChanged, map } from "rxjs/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export interface KaartProps {
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoom: number;
}

@Component({
  selector: "awv-kaart-zoom",
  templateUrl: "./kaart-zoom.component.html",
  styleUrls: ["./kaart-zoom.component.scss"]
})
export class KaartZoomComponent extends KaartChildComponentBase implements OnInit {
  kaartProps$: Observable<KaartProps> = Observable.empty();

  constructor(private readonly parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  ngOnInit() {
    super.ngOnInit();

    this.kaartProps$ = this.parent.modelChanges.viewinstellingen$.pipe(
      map(viewinstellingen => ({
        canZoomIn: viewinstellingen.zoom + 1 <= viewinstellingen.maxZoom,
        canZoomOut: viewinstellingen.zoom - 1 >= viewinstellingen.minZoom,
        zoom: viewinstellingen.zoom
      })),
      distinctUntilChanged()
    );
  }

  zoomIn(props: KaartProps) {
    if (props.canZoomIn) {
      this.dispatch(prt.VeranderZoomCmd(props.zoom + 1, kaartLogOnlyWrapper));
    }
  }

  zoomOut(props: KaartProps) {
    if (props.canZoomOut) {
      this.dispatch(prt.VeranderZoomCmd(props.zoom - 1, kaartLogOnlyWrapper));
    }
  }
}
