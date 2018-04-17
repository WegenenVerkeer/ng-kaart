import { Input, OnDestroy, OnInit, NgZone } from "@angular/core";
import * as rx from "rxjs";

import { KaartComponentBase } from "./kaart-component-base";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartInternalMsg, KaartInternalSubMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { kaartLogger } from "./log";
import { internalMsgSubscriptionCmdOperator } from "./subscription-helper";

export abstract class KaartChildComponentBase extends KaartComponentBase implements OnInit, OnDestroy {
  private subHelperSub: rx.Subscription = new rx.Subscription();

  @Input() dispatcher: KaartCmdDispatcher<prt.TypedRecord> = VacuousDispatcher;
  @Input() internalMessage$: rx.Observable<KaartInternalSubMsg> = rx.Observable.never();

  constructor(zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [];
  }

  ngOnInit() {
    super.ngOnInit();
    if (this.kaartSubscriptions().length > 0) {
      this.subHelperSub.unsubscribe(); // voor de zekerheid
      this.subHelperSub = this.internalMessage$
        .lift(internalMsgSubscriptionCmdOperator(this.dispatcher, ...this.kaartSubscriptions()))
        .subscribe(err => kaartLogger.error);
    }
  }

  ngOnDestroy() {
    this.subHelperSub.unsubscribe(); // Stop met luisteren op subscriptions
    super.ngOnDestroy();
  }

  dispatch(cmd: prt.Command<prt.TypedRecord>) {
    this.dispatcher.dispatch(cmd);
  }
}
