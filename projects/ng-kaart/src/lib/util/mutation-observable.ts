import * as rx from "rxjs";

import { kaartLogger } from "../kaart/log";

export function observableFromDomMutations<A extends ol.events.Event>(
  cfg: MutationObserverInit,
  ...targets: Node[]
): rx.Observable<MutationRecord[]> {
  return rx.Observable.create((subscriber: rx.Subscriber<MutationRecord[]>) => {
    let mutObserver: MutationObserver;
    try {
      mutObserver = new MutationObserver(mutations => subscriber.next(mutations));
      targets.forEach(target => mutObserver.observe(target, cfg));
    } catch (err) {
      subscriber.error(err);
    }
    return () => {
      kaartLogger.debug("release mutation observer");
      if (mutObserver) {
        mutObserver.disconnect();
      }
    };
  });
}
