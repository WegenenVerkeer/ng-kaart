import { Map, Set } from "immutable";
import { Subject } from "rxjs/Rx";
import { Subscription } from "rxjs/Subscription";

import { AbstractZoeker, ZoekResultaten } from "./abstract-zoeker";

export class ZoekerCoordinator {
  private zoekers: Array<AbstractZoeker> = Array();
  private zoekerSubscriptions: Map<string, Subscription> = Map();

  constructor(private zoekerSubject: Subject<ZoekResultaten>) {}

  isZoekerGeregistreerd(naam: string): boolean {
    return this.zoekers.some(zoeker => zoeker.naam() === naam);
  }

  isMinstens1ZoekerGeregistreerd(): boolean {
    return this.zoekers.length > 0;
  }

  verwijderZoeker(naam: string) {
    this.zoekerSubscriptions
      .filter((subscription, zoekerNaam) => zoekerNaam === naam)
      .forEach((subscription, zoekerNaam) => this.unsubscribeZoeker(subscription!, zoekerNaam!));

    this.zoekerSubscriptions = this.zoekerSubscriptions.delete(naam);
    this.zoekers = this.zoekers.filter(zoeker => zoeker.naam() !== naam);
  }

  unsubscribeZoeker(subscription: Subscription, zoekerNaam: string) {
    // Stuur leeg zoekresultaat voor de zoekers met subscriptions.
    this.zoekerSubject.next(new ZoekResultaten(zoekerNaam));
    subscription.unsubscribe();
  }

  voegZoekerToe(zoeker: AbstractZoeker) {
    this.zoekers = this.zoekers.concat(zoeker);
  }

  zoek(input: string, zoekers: Set<string>) {
    // Annuleer bestaande zoekOpdrachten.
    this.zoekerSubscriptions.forEach((subscription, zoekerNaam) => this.unsubscribeZoeker(subscription!, zoekerNaam!));
    // Stuur zoek comando naar alle geregistreerde zoekers of enkel naar de gespecifieerde.
    const gekozenZoekers = zoekers.isEmpty() ? this.zoekers : this.zoekers.filter(zoeker => zoekers.contains(zoeker.naam()));
    this.zoekerSubscriptions = gekozenZoekers.reduce(
      (subscriptions, zoeker) =>
        subscriptions.set(
          zoeker.naam(),
          zoeker.zoek$(input).subscribe(zoekResultaat => {
            this.zoekerSubject.next(zoekResultaat);
          })
        ),
      Map<string, Subscription>()
    );
  }
}
