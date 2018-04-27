import { Input, NgZone, OnDestroy, OnInit } from "@angular/core";
import * as rx from "rxjs";

import { KaartComponentBase } from "./kaart-component-base";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartInternalMsg, KaartInternalSubMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { kaartLogger } from "./log";
import { internalMsgSubscriptionCmdOperator } from "./subscription-helper";
import { KaartComponent } from ".";
import { Observable } from "openlayers";
import { KaartWithInfo } from "./kaart-with-info";

/**
 * Voor classes die view children zijn van kaart.component
 */
export abstract class KaartChildComponentBase extends KaartComponentBase implements OnInit, OnDestroy {
  // @Input() dispatcher: KaartCmdDispatcher<prt.TypedRecord> = VacuousDispatcher;
  // @Input() internalMessage$: rx.Observable<KaartInternalSubMsg> = rx.Observable.never();

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [];
  }

  ngOnInit() {
    super.ngOnInit();
    if (this.kaartSubscriptions().length > 0) {
      this.bindToLifeCycle(
        this.internalMessage$.lift(
          internalMsgSubscriptionCmdOperator(this.kaartComponent.internalCmdDispatcher, ...this.kaartSubscriptions())
        )
      ).subscribe(
        err => kaartLogger.error("De subscription gaf een logische fout", err),
        err => kaartLogger.error("De subscription gaf een technische fout", err),
        () => kaartLogger.debug("De source is gestopt")
      );
    }
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  protected dispatch(cmd: prt.Command<KaartInternalMsg>) {
    this.kaartComponent.internalCmdDispatcher.dispatch(cmd);
  }

  protected get internalMessage$(): rx.Observable<KaartInternalSubMsg> {
    return this.kaartComponent.internalMessage$;
  }

  protected get kaartModel$(): rx.Observable<KaartWithInfo> {
    return this.kaartComponent.kaartModel$;
  }
}
