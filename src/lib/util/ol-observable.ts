import * as ol from "openlayers";
import * as rx from "rxjs";
import { Subscriber } from "rxjs/src/Subscriber";

import { kaartLogger } from "../kaart/log";

export function observableFromOlEvents<A extends ol.events.Event>(olObj: ol.Object, ...eventTypes: string[]): rx.Observable<A> {
  return rx.Observable.create((subscriber: Subscriber<A>) => {
    let eventsKeys: ol.EventsKey[];
    try {
      eventsKeys = olObj.on(eventTypes, (a: A) => subscriber.next(a)) as ol.EventsKey[];
    } catch (err) {
      eventsKeys = [];
      subscriber.error(err);
    }
    return () => {
      kaartLogger.debug("release events ", eventTypes, eventsKeys);
      ol.Observable.unByKey(eventsKeys);
    };
  });
}
