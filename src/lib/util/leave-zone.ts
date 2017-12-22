import { Operator } from "rxjs/Operator";
import { Subscriber } from "rxjs/Subscriber";
import { Observable } from "rxjs/Observable";

import { ZoneLike } from "./zone-like";

/**
 * Gebaseerd op https://github.com/ksachdeva/rxjs-zone-operators
 */

type LeaveZoneSignature<T> = (zone: ZoneLike) => Observable<T>;

class LeaveZoneSubscriber<T> extends Subscriber<T> {
  constructor(destination: Subscriber<T>, private _zone: ZoneLike) {
    super(destination);
  }

  protected _next(value: T) {
    this._zone.runOutsideAngular(() => this.destination.next(value));
  }
}

class LeaveZoneOperator<T> implements Operator<T, T> {
  constructor(private _zone: ZoneLike) {}

  call(subscriber: Subscriber<T>, source: any): any {
    return source._subscribe(new LeaveZoneSubscriber(subscriber, this._zone));
  }
}

export function leaveZone<T>(this: Observable<T>, zone: ZoneLike): Observable<T> {
  return this.lift(new LeaveZoneOperator(zone));
}

Observable.prototype.leaveZone = leaveZone;

declare module "rxjs/Observable" {
  // tslint:disable-next-line:no-shadowed-variable
  interface Observable<T> {
    // leaveZone: LeaveZoneSignature<T>;
    leaveZone: typeof leaveZone;
  }
}
