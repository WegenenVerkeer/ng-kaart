import { NgZone, OnDestroy, OnInit } from "@angular/core";
import * as rx from "rxjs";

import { KaartComponentBase } from "./kaart-component-base";
import { KaartInternalMsg, KaartInternalSubMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { KaartComponent } from "./kaart.component";
import { kaartLogger } from "./log";
import { ModelChanges } from "./model-changes";
import { internalMsgSubscriptionCmdOperator } from "./subscription-helper";

/**
 * Voor classes die view children zijn van kaart.component
 */
export abstract class KaartChildComponentBase extends KaartComponentBase implements OnInit, OnDestroy {
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

  protected get modelChanges(): ModelChanges {
    return this.kaartComponent.modelChanges;
  }
}
