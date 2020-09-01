import { ResizeObserver } from "resize-observer";
import { ResizeObserverEntry } from "resize-observer/lib/ResizeObserverEntry";
import * as rx from "rxjs";

import { kaartLogger } from "../kaart/log";

export function resizeObservable(
  ...elts: Element[]
): rx.Observable<ResizeObserverEntry[]> {
  return rx.Observable.create(
    (subscriber: rx.Subscriber<ResizeObserverEntry[]>) => {
      let resizeObserver: ResizeObserver;
      try {
        resizeObserver = new ResizeObserver((mutations) =>
          subscriber.next(mutations)
        );
        elts.forEach((elt) => resizeObserver.observe(elt));
      } catch (err) {
        subscriber.error(err);
      }
      return () => {
        kaartLogger.debug("release resize observer");
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  );
}
