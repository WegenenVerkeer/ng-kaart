import { Observable } from "rxjs/Observable";
import { ReplaySubject } from "rxjs/ReplaySubject";

import { asap } from "../util/asap";

import * as prt from "./kaart-protocol";

export interface KaartCmdDispatcher<Msg extends prt.TypedRecord> {
  dispatch(cmd: prt.Command<Msg>): void;
}

export interface KaartEventSource {
  commands$: Observable<prt.Command<any>>;
}

export class ReplaySubjectKaartCmdDispatcher<Msg extends prt.TypedRecord> implements KaartCmdDispatcher<Msg>, KaartEventSource {
  // Er worden al events gegenereerd voordat de kaartcomponent actief is. Daarom tot 1000 events onthouden 500ms lang.
  private readonly eventSubj = new ReplaySubject<prt.Command<Msg>>(1000, 500);

  dispatch(cmd: prt.Command<Msg>) {
    // We willen dat events pas uitgevoerd worden nadat de huidige processing gedaan is,
    // anders kan een eventhandler het model updaten terwijl een commandhandler nog niet gereed is,
    // als die commandhandler dan ook het model update, gebeurt dit in de verkeerde volgorde.
    asap(() => this.eventSubj.next(cmd));
  }

  get commands$(): Observable<prt.Command<Msg>> {
    return this.eventSubj;
  }
}

// noinspection JSUnusedLocalSymbols
export const VacuousDispatcher: KaartCmdDispatcher<any> = {
  dispatch(cmd: prt.Command<any>) {}
};
