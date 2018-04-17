import { Component, NgZone, OnInit } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { ofType } from "../util/operators";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { KaartInternalMsg, kaartLogOnlyWrapper, ZoominstellingenGezetMsg, zoominstellingenGezetWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

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

  constructor(zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ZoominstellingenSubscription(zoominstellingenGezetWrapper)];
  }

  ngOnInit() {
    super.ngOnInit();

    this.kaartProps$ = this.internalMessage$.pipe(
      ofType<ZoominstellingenGezetMsg>("ZoominstellingenGezet"),
      map(m => ({
        canZoomIn: m.zoominstellingen.zoom + 1 <= m.zoominstellingen.maxZoom,
        canZoomOut: m.zoominstellingen.zoom - 1 >= m.zoominstellingen.minZoom,
        zoom: m.zoominstellingen.zoom
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
