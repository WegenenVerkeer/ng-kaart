import { AfterViewInit, Directive, EventEmitter, Injector, Output } from "@angular/core";
import { merge } from "rxjs";
import { distinctUntilChanged, tap } from "rxjs/operators";

import * as prt from "../../kaart/kaart-protocol";
import { ofType } from "../../util/operators";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";
import { classicMsgSubscriptionCmdOperator } from "../kaart-classic.component";
import { KaartClassicMsg, MijnLocatieStateChangeMsg } from "../messages";

interface StateChange {
  readonly oudeState: string;
  readonly nieuweState: string;
  readonly event: string;
}

@Directive()
export class ClassicMijnLocatieDirective extends ClassicUIElementSelectorDirective implements AfterViewInit {
  @Output()
  stateChange: EventEmitter<StateChange> = new EventEmitter<StateChange>();

  constructor(uiSelector: string, injector: Injector) {
    super(uiSelector, injector);
  }

  ngAfterViewInit() {
    this.bindToLifeCycle(
      merge(
        this.kaart.kaartClassicSubMsg$.lift(
          classicMsgSubscriptionCmdOperator(
            this.kaart.dispatcher,
            prt.MijnLocatieStateChangeSubscription(stateChange =>
              KaartClassicMsg(MijnLocatieStateChangeMsg(stateChange.oudeState, stateChange.nieuweState, stateChange.event))
            )
          )
        ),
        this.kaart.kaartClassicSubMsg$.pipe(
          ofType<MijnLocatieStateChangeMsg>("MijnLocatieStateChangeMsg"),
          distinctUntilChanged(),
          tap(stateChange =>
            this.stateChange.emit({ oudeState: stateChange.oudeState, nieuweState: stateChange.nieuweState, event: stateChange.event })
          )
        )
      )
    ).subscribe();
  }
}
