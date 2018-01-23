import { NgZone, OnInit, OnDestroy } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Subscription } from "rxjs/Subscription";
import { takeUntil } from "rxjs/operators";

import { leaveZone } from "../util/leave-zone";

export abstract class KaartComponentBase implements OnInit, OnDestroy {
  private readonly destroyingSubj: Subject<void> = new Subject<void>();

  constructor(readonly zone: NgZone) {}

  ngOnInit() {}

  ngOnDestroy() {
    this.destroyingSubj.next();
  }

  bindToLifeCycle<T>(source: Observable<T>): Observable<T> {
    return source.pipe(takeUntil(this.destroyingSubj));
  }

  public get destroying$(): Observable<void> {
    return this.destroyingSubj;
  }

  /**
   * Voor deze functie uit zonder de Angular change detection en zonder de caller te blokkeren.
   * @param f de uit te voeren functie
   */
  protected runAsapOutsideAngular(f: () => void): void {
    this.zone.runOutsideAngular(() => setTimeout(f, 0));
  }

  protected runOutsideAngular<T>(f: () => T): T {
    return this.zone.runOutsideAngular(f);
  }
}
