import {
  AfterViewInit,
  Directive,
  NgZone,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from "@angular/core";
import { Lazy } from "fp-ts/es6/function";
import { identity, Refinement } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { filter, map, mapTo, switchMap, takeUntil } from "rxjs/operators";

import { asap } from "../util/asap";
import { isNotNullOrUndefined } from "../util/null";

interface ClickAction {
  name: string;
  data?: any;
}

/**
 * Algemene basisklasse die gebruikt kan worden voor zowel child components van de kaartcomponent als voor kaart classic helper components.
 */
@Directive()
export abstract class KaartBaseDirective
  implements AfterViewInit, OnInit, OnDestroy {
  private readonly destroyingSubj: rx.Subject<void> = new rx.ReplaySubject<
    void
  >(1); // ReplaySubject => laatkomers krijgen toch nog event
  private readonly initialisingSubj: rx.Subject<void> = new rx.ReplaySubject<
    void
  >(1);
  private readonly viewReadySubj: rx.Subject<void> = new rx.ReplaySubject<void>(
    1
  );
  private readonly clickActionSubj: rx.Subject<ClickAction> = new rx.Subject<
    ClickAction
  >();

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

  /**
   * Event methode bedoeld om aangeroepen te worden vanuit een HTML template. Componenten kunnen luisteren op een
   * afgeleide Observable om deze acties te volgen.
   * @param actionName Een string die een actie identificeert.
   * @param data Optionele, arbitraire data
   */
  onAction(actionName: string, data?: any) {
    this.clickActionSubj.next({ name: actionName, data: data });
  }

  /**
   * Transformeert de input observable zodat die afgesloten wordt op het moment dat de component verwijderd wordt.
   */
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

  // Enkel voor debug! Handig om te weten wat er nu exact doorgestuurd wordt.
  protected action$(): rx.Observable<ClickAction> {
    return this.clickActionSubj.asObservable();
  }

  protected actionFor$(action: string): rx.Observable<void> {
    return this.clickActionSubj.pipe(
      filter((a) => a.name === action),
      mapTo(undefined)
    );
  }

  protected rawActionDataFor$(actionName: string): rx.Observable<any> {
    return this.clickActionSubj.pipe(
      filter((a) => a.name === actionName && a.data !== undefined),
      map((a) => a.data)
    );
  }

  protected actionDataFor$<T>(
    actionName: string,
    refinement: Refinement<any, T>
  ): rx.Observable<T> {
    return this.clickActionSubj.pipe(
      filter(
        (a) =>
          a.name === actionName &&
          isNotNullOrUndefined(a.data) &&
          refinement(a.data)
      ),
      map((a) => a.data)
    );
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

  protected inViewReady<T>(obsGen: Lazy<rx.Observable<T>>): rx.Observable<T> {
    return this.viewReady$.pipe(switchMap(obsGen));
  }

  /**
   * Voer de observable uit vanaf de component klaar is tot die stopt.
   * Om iets nuttig te doen, moeten de observables side-effects gebruiken. Als dat op de gepaste plaats
   * gebeurt, i.e. als allerlaatste operatie in een tap, is dit nog overzichtelijk.
   */
  protected runInViewReady(os: rx.Observable<any>) {
    this.bindToLifeCycle(this.inViewReady(() => os)).subscribe();
  }
}

export function forChangedValue<A, B>(
  changes: SimpleChanges,
  prop: string,
  action: (cur: B, prev: B) => void,
  conv: (a: A) => B = identity as (a: A) => B,
  pred: (cur: B, prev: B) => boolean = () => true
): void {
  if (
    prop in changes &&
    (!changes[prop].previousValue ||
      pred(conv(changes[prop].currentValue), conv(changes[prop].previousValue)))
  ) {
    action(conv(changes[prop].currentValue), conv(changes[prop].previousValue));
  }
}
