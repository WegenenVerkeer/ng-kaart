import { Component, Input, NgZone, OnDestroy, OnChanges } from "@angular/core";
import { SimpleChanges } from "@angular/core/src/metadata/lifecycle_hooks";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { KaartWithInfo } from "./kaart-with-info";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { VeranderZoomniveau } from "./kaart-protocol-commands";
import { observeOnAngular } from "../util/observe-on-angular";
import { KaartInternalMsg } from "./kaart-internal-messages";

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
export class KaartZoomComponent extends KaartComponentBase implements OnChanges, OnDestroy {
  kaartProps$: Observable<KaartProps> = Observable.empty();

  @Input() kaartModel$: Observable<KaartWithInfo> = Observable.never();
  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;

  private static canZoomIn(m: KaartWithInfo): boolean {
    return m.zoom + 1 <= m.maxZoom;
  }

  private static canZoomOut(m: KaartWithInfo): boolean {
    return m.zoom - 1 >= m.minZoom;
  }

  constructor(zone: NgZone) {
    super(zone);
  }

  ngOnChanges(changes: SimpleChanges) {
    // this.kaartProps$ = this.kaartModel$.pipe(
    //   map(m => ({
    //     canZoomIn: KaartZoomComponent.canZoomIn(m),
    //     canZoomOut: KaartZoomComponent.canZoomOut(m),
    //     zoom: m.zoom
    //   })),
    //   observeOnAngular(this.zone)
    // );
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  zoomIn(props: KaartProps) {
    if (props.canZoomIn) {
      // this.dispatcher.dispatch(new VeranderZoomniveau(props.zoom + 1));
    }
  }

  zoomOut(props: KaartProps) {
    if (props.canZoomOut) {
      // this.dispatcher.dispatch(new VeranderZoomniveau(props.zoom - 1));
    }
  }
}
