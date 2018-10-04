import { none, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { delay } from "rxjs/operators";

import { rangeArray } from "../lib/util/range";
import { Zoeker, ZoekerBase, ZoekInput, ZoekResultaten } from "../lib/zoeker";

/**
 * Een Zoeker die vrij random resultaten genereert.
 */
export class DummyZoeker extends ZoekerBase implements Zoeker {
  constructor(naam = "dummy", prioriteit = 1) {
    super(naam, prioriteit, prioriteit);
  }

  zoek$(input: ZoekInput): rx.Observable<ZoekResultaten> {
    switch (input.type) {
      case "string":
        const numResults = Math.floor(Math.pow(Math.random(), 1.2) * 5);
        const resultaat = index => ({
          partialMatch: Math.random() < 0.25,
          index: index,
          omschrijving: `resultaat_${input} (${this.naam()}_${index})`,
          bron: "bron",
          zoeker: this.naam(),
          kaartInfo: none,
          icoon: { type: "font" as "font", name: "Du" },
          preferredPointZoomLevel: some(4 + Math.random() * 5)
        });
        const resultaten = rangeArray(numResults).map(resultaat);
        return rx.Observable.of(new ZoekResultaten(this.naam(), this.zoekPrioriteit(), [], resultaten));
      default:
        return rx.Observable.empty();
    }
  }

  suggesties$(input: string): rx.Observable<ZoekResultaten> {
    const numResults = Math.floor(Math.pow(Math.random(), 1.3) * 4);
    const resultaat = index => ({
      partialMatch: Math.random() > 0.2,
      index: index,
      omschrijving: input + `(${this.naam()}_${index})`,
      bron: "bron",
      zoeker: this.naam(),
      kaartInfo: none,
      icoon: { type: "font" as "font", name: "Du" },
      preferredPointZoomLevel: some(4 + Math.random() * 5)
    });
    const resultaten = rangeArray(numResults).map(resultaat);
    return rx.Observable.of(new ZoekResultaten(this.naam(), this.suggestiePrioriteit(), [], resultaten)).pipe(delay(Math.random() * 2000));
  }
}
