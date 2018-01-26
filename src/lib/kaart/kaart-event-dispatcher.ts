import { Observable } from "rxjs/Observable";
import { ReplaySubject } from "rxjs/ReplaySubject";

import * as prt from "./kaart-protocol-events";

export interface KaartEventDispatcher {
  dispatch(evt: prt.KaartEvnt): void;
}

export interface KaartEventSource {
  event$: Observable<prt.KaartEvnt>;
}

export class ReplaySubjectKaartEventDispatcher implements KaartEventDispatcher, KaartEventSource {
  // Er worden al events gegenereerd voordat de kaartcomponent actief is. Daarom tot 1000 events onthouden 500ms lang.
  private readonly eventSubj = new ReplaySubject<prt.KaartEvnt>(1000, 500);

  dispatch(evt: prt.KaartEvnt) {
    this.eventSubj.next(evt);
  }

  get event$(): Observable<prt.KaartEvnt> {
    return this.eventSubj;
  }
}

// noinspection JSUnusedLocalSymbols
export const VacuousDispatcher: KaartEventDispatcher = {
  dispatch(evt: prt.KaartEvnt) {}
};
