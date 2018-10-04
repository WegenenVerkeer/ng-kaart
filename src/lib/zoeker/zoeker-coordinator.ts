import { List, Map, Set } from "immutable";
import * as rx from "rxjs";
import { OperatorFunction } from "rxjs/interfaces";
import { mergeAll, switchMap, tap } from "rxjs/operators";

import { Zoeker, ZoekInput, ZoekResultaat, ZoekResultaten } from "./zoeker";

export class ZoekerCoordinator {
  private zoekers: Array<Zoeker> = Array();
  private zoekSubj: rx.Subject<{ input: ZoekInput; zoekers: Array<Zoeker> }> = new rx.Subject();
  private suggestiesZoekSubj: rx.Subject<{ zoekterm: string; zoekers: Array<Zoeker> }> = new rx.Subject();
  readonly zoekResultaten$: rx.Observable<ZoekResultaten>;
  readonly vlugZoekResultaten$: rx.Observable<ZoekResultaten>;

  constructor(private zoekerResultaatKlikSubj: rx.Subject<ZoekResultaat>) {
    this.zoekResultaten$ = this.zoekSubj.pipe(
      switchMap(vz =>
        rx.Observable.from(vz.zoekers.map(zoeker => zoeker.zoek$(vz.input))) //
          .pipe(mergeAll() as OperatorFunction<rx.Observable<ZoekResultaten>, ZoekResultaten>)
      )
    );
    this.vlugZoekResultaten$ = this.suggestiesZoekSubj.pipe(
      switchMap(vz =>
        rx.Observable.from(vz.zoekers.map(zoeker => zoeker.suggesties$(vz.zoekterm))) //
          .pipe(mergeAll() as OperatorFunction<rx.Observable<ZoekResultaten>, ZoekResultaten>)
      )
    );
  }

  isZoekerGeregistreerd(naam: string): boolean {
    return this.zoekers.some(zoeker => zoeker.naam() === naam);
  }

  isMinstens1ZoekerGeregistreerd(): boolean {
    return this.zoekers.length > 0;
  }

  verwijderZoeker(naam: string) {
    this.zoekers = this.zoekers.filter(zoeker => zoeker.naam() !== naam);
  }

  private unsubscribeZoeker(subscription: rx.Subscription) {
    subscription.unsubscribe();
  }

  voegZoekerToe(zoeker: Zoeker) {
    this.zoekers = this.zoekers.concat(zoeker);
  }

  zoekResultaatGeklikt(resultaat: ZoekResultaat) {
    this.zoekerResultaatKlikSubj.next(resultaat);
  }

  zoek(input: ZoekInput, zoekerNamen: Set<string>) {
    console.log("****Z sending to subject");
    this.zoekSubj.next({
      input: input,
      zoekers: this.zoekersMetNaam(zoekerNamen)
    });
  }

  zoekSuggesties(zoekterm: string, zoekerNamen: Set<string>) {
    this.suggestiesZoekSubj.next({
      zoekterm: zoekterm,
      zoekers: this.zoekersMetNaam(zoekerNamen)
    });
  }

  private zoekersMetNaam(zoekerNamen: Set<string>): Zoeker[] {
    return zoekerNamen.isEmpty ? this.zoekers : this.zoekers.filter(zoeker => zoekerNamen.contains(zoeker.naam()));
  }

  zoekerServices(): List<Zoeker> {
    return List(this.zoekers);
  }
}
