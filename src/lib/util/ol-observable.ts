import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Subscriber } from "rxjs/src/Subscriber";

import { forEach } from "./option";

export function observableFromOlEvent<A extends ol.events.Event>(olObj: ol.Object, eventType: string): rx.Observable<A> {
  return rx.Observable.create((subscriber: Subscriber<A>) => {
    let eventsKey: Option<ol.EventsKey>;
    try {
      eventsKey = some(olObj.on(eventType, (a: A) => subscriber.next(a)));
    } catch (err) {
      eventsKey = none;
      subscriber.error(err);
    }
    return () => {
      console.log("release event ", eventType);
      forEach(eventsKey, key => ol.Object.unByKey(key));
    };
  });
}

export function observableFromOlEvents<A extends ol.events.Event>(olObj: ol.Object, eventTypes: string[]): rx.Observable<A> {
  return rx.Observable.create((subscriber: Subscriber<A>) => {
    let eventsKeys: ol.EventsKey[];
    try {
      eventsKeys = olObj.on(eventTypes, (a: A) => subscriber.next(a)) as ol.EventsKey[];
    } catch (err) {
      eventsKeys = [];
      subscriber.error(err);
    }
    return () => {
      console.log("release events ", eventTypes);
      eventsKeys.forEach(key => ol.Object.unByKey(key));
    };
  });
}
