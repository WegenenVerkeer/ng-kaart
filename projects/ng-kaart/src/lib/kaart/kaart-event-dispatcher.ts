import * as rx from "rxjs";

import { asap } from "../util/asap";
import { TypedRecord } from "../util/typed-record";

import * as prt from "./kaart-protocol";

export interface KaartCmdDispatcher<Msg extends TypedRecord> {
  dispatch(cmd: prt.Command<Msg>): void;
}

export interface KaartEventSource {
  commands$: rx.Observable<prt.Command<any>>;
}

export class ReplaySubjectKaartCmdDispatcher<Msg extends TypedRecord> implements KaartCmdDispatcher<Msg>, KaartEventSource {
  // Er worden al events gegenereerd voordat de kaartcomponent actief is. Daarom tot 1000 events onthouden 500ms lang.
  private readonly eventSubj = new rx.ReplaySubject<prt.Command<Msg>>(1000, 500);

  dispatch(cmd: prt.Command<Msg>) {
    // We willen dat events pas uitgevoerd worden nadat de huidige processing gedaan is,
    // anders kan een eventhandler het model updaten terwijl een commandhandler nog niet gereed is,
    // als die commandhandler dan ook het model update, gebeurt dit in de verkeerde volgorde.
    asap(() => this.eventSubj.next(cmd));
  }

  get commands$(): rx.Observable<prt.Command<Msg>> {
    return this.eventSubj;
  }
}

// noinspection JSUnusedLocalSymbols
export const VacuousDispatcher: KaartCmdDispatcher<any> = {
  dispatch() {}
};
