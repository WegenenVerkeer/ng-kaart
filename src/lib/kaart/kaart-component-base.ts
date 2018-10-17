import { AfterViewInit, NgZone, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import * as rx from "rxjs";
import { filter, map, mapTo, takeUntil } from "rxjs/operators";

import { asap } from "../util/asap";
import { Refinement } from "fp-ts/lib/function";

interface ClickAction {
  name: string;
  data: any;
}

/**
 * Algemene basisklasse die gebruikt kan worden voor zowel child components van de kaartcomponent als voor kaart classic helper components.
 */
export abstract class KaartComponentBase implements AfterViewInit, OnInit, OnDestroy {
  private readonly destroyingSubj: rx.Subject<void> = new rx.ReplaySubject<void>(1); // ReplaySubject => laatkomers krijgen toch nog event
  private readonly initialisingSubj: rx.Subject<void> = new rx.ReplaySubject<void>(1);
  private readonly viewReadySubj: rx.Subject<void> = new rx.ReplaySubject<void>(1);
  private readonly clickActionSubj: rx.Subject<ClickAction> = new rx.Subject<ClickAction>();

  constructor(readonly zone: NgZone) {}

  ngOnInit() {
    this.initialisingSubj.next();
    this.initialisingSubj.complete();
  }

  ngOnDestroy() {
    this.destroyingSubj.next();
    this.destroyingSubj.complete();
  }

  ngAfterViewInit() {
    this.viewReadySubj.next();
    this.viewReadySubj.complete();
  }

  onClick(action: string, data: any) {
    this.clickActionSubj.next({ name: action, data: data });
  }

  protected bindToLifeCycle<T>(source: rx.Observable<T>): rx.Observable<T> {
    return source ? source.pipe(takeUntil(this.destroyingSubj)) : source;
  }

  protected get initialising$(): rx.Observable<void> {
    return this.initialisingSubj.pipe(takeUntil(this.destroyingSubj));
  }

  protected get destroying$(): rx.Observable<void> {
    return this.destroyingSubj;
  }

  protected get viewReady$(): rx.Observable<void> {
    return this.viewReadySubj;
  }

  protected clickFor$(action: string): rx.Observable<void> {
    return this.clickActionSubj.pipe(filter(a => a.name === action), mapTo(undefined));
  }

  protected rawClickDataFor$(action: string): rx.Observable<any> {
    return this.clickActionSubj.pipe(filter(a => a.name === action), map(a => a.data));
  }

  protected clickDataFor$<T>(action: string, refinement: Refinement<any, T>): rx.Observable<T> {
    return this.clickActionSubj.pipe(filter(a => a.name === action), filter(a => refinement(a.data)), map(a => a.data));
  }

  /**
   * Voor deze functie uit zonder de Angular change detection en zonder de caller te blokkeren.
   * @param f de uit te voeren functie
   */
  protected runAsapOutsideAngular(f: () => void): void {
    this.zone.runOutsideAngular(() => asap(f));
  }

  protected runOutsideAngular<T>(f: () => T): T {
    return this.zone.runOutsideAngular(f);
  }
}

export function forChangedValue(
  changes: SimpleChanges,
  prop: string,
  action: (cur: any, prev: any) => void,
  pred: (cur: any, prev: any) => boolean = () => true
): void {
  if (prop in changes && (!changes[prop].previousValue || pred(changes[prop].currentValue, changes[prop].previousValue))) {
    action(changes[prop].currentValue, changes[prop].previousValue);
  }
}
