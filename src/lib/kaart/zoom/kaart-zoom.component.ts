import { Component, NgZone, OnInit } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { ofType } from "../../util/operators";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartInternalMsg, kaartLogOnlyWrapper, ViewinstellingenGezetMsg, viewinstellingenGezetWrapper } from "../kaart-internal-messages";
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

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ViewinstellingenSubscription(viewinstellingenGezetWrapper)];
  }

  ngOnInit() {
    super.ngOnInit();

    this.kaartProps$ = this.internalMessage$.pipe(
      ofType<ViewinstellingenGezetMsg>("ViewinstellingenGezet"),
      map(m => ({
        canZoomIn: m.viewinstellingen.zoom + 1 <= m.viewinstellingen.maxZoom,
        canZoomOut: m.viewinstellingen.zoom - 1 >= m.viewinstellingen.minZoom,
        zoom: m.viewinstellingen.zoom
      }))
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
