import { NgZone, OnDestroy, OnInit } from "@angular/core";
import * as rx from "rxjs";
import { distinctUntilChanged, shareReplay, tap } from "rxjs/operators";

import { collectOption } from "../util/operators";

import { KaartComponentBase } from "./kaart-component-base";
import { KaartInternalMsg, KaartInternalSubMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { KaartComponent } from "./kaart.component";
import { kaartLogger } from "./log";
import { ModelChanges } from "./model-changes";
import { internalMsgSubscriptionCmdOperator } from "./subscription-helper";
import { OptiesOpUiElement } from "./ui-element-opties";

/**
 * Voor classes die view children zijn van kaart.component
 */
export abstract class KaartChildComponentBase extends KaartComponentBase implements OnInit, OnDestroy {
  constructor(protected readonly kaartComponent: KaartComponent, zone: NgZone) {
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

  protected accumulatedOpties$<A extends object>(selectorName: string): rx.Observable<A> {
    // Dispatch zodat elke component de begintoestand kan kennen ipv enkel deze component.
    // if (init !== undefined) {
    //   this.dispatch(prt.InitUiElementOpties(selectorName, init));
    // }
    // Volg de globale toestand
    return this.modelChanges.optiesOpUiElement$.pipe(
      collectOption(OptiesOpUiElement.getOption<A>(selectorName)),
      distinctUntilChanged(), // object identity kan theoretisch te veel opties doorlaten, maar niet te weinig gezien immutable opties
      shareReplay(1) // De bron is wel een BehaviorSubject, maar ook de rest van de ketting moet replayable zijn
    );
  }

  protected dispatch(cmd: prt.Command<KaartInternalMsg> | prt.Command<prt.KaartMsg>) {
    this.kaartComponent.internalCmdDispatcher.dispatch(cmd);
  }

  protected dispatchCmdsInViewReady(...cmds: (rx.Observable<prt.Command<KaartInternalMsg | prt.KaartMsg>>)[]) {
    this.runInViewReady(rx.merge(...cmds).pipe(tap(cmd => this.dispatch(cmd))));
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

  protected get aanwezigeElementen$(): rx.Observable<Set<string>> {
    return this.kaartComponent.aanwezigeElementen$;
  }
}
