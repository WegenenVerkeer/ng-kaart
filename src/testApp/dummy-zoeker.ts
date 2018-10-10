import { none, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { delay } from "rxjs/operators";

import { rangeArray } from "../lib/util/range";
import { nietOndersteund, Zoeker, ZoekInput, Zoekopdracht, ZoekResultaten, Zoektype } from "../lib/zoeker/zoeker";

/**
 * Een Zoeker die vrij random resultaten genereert.
 */
export class DummyZoeker implements Zoeker {
  constructor(private readonly _naam = "dummy") {}

  naam() {
    return this._naam;
  }

  zoekresultaten$(zoekopdracht: Zoekopdracht): rx.Observable<ZoekResultaten> {
    switch (zoekopdracht.zoektype) {
      case "Volledig":
        return this.zoek$(zoekopdracht.zoekpatroon);
      case "Suggesties":
        return this.suggesties$(zoekopdracht.zoekpatroon);
    }
  }

  zoek$(input: ZoekInput): rx.Observable<ZoekResultaten> {
    switch (input.type) {
      case "string":
        const numResults = Math.floor(Math.pow(Math.random(), 1.2) * 5);
        const resultaat = index => ({
          partialMatch: Math.random() < 0.25,
          featureIdSuffix: index,
          omschrijving: `resultaat_${input.value}`,
          extraOmschrijving: some(`${this.naam()}_${index}`),
          bron: "bron",
          zoeker: this.naam(),
          kaartInfo: none,
          icoon: { type: "font" as "font", name: "Du" },
          preferredPointZoomLevel: some(4 + Math.random() * 5)
        });
        const resultaten = rangeArray(numResults).map(resultaat);
        return rx.of(new ZoekResultaten(this.naam(), "Volledig", [], resultaten));
      default:
        return rx.of(nietOndersteund(this.naam(), "Volledig"));
    }
  }

  suggesties$(input: ZoekInput): rx.Observable<ZoekResultaten> {
    switch (input.type) {
      case "string":
        const numResults = Math.floor(Math.pow(Math.random(), 1.3) * 4);
        const resultaat = index => ({
          partialMatch: Math.random() > 0.2,
          featureIdSuffix: index,
          omschrijving: `${input.value} (${this.naam()}_${index})`,
          extraOmschrijving: none,
          bron: "bron",
          zoeker: this.naam(),
          kaartInfo: none,
          icoon: { type: "font" as "font", name: "Du" },
          preferredPointZoomLevel: some(4 + Math.random() * 5),
          zoektype: "Suggesties" as Zoektype
        });
        const resultaten = rangeArray(numResults).map(resultaat);
        return rx.of(new ZoekResultaten(this.naam(), "Suggesties", [], resultaten)).pipe(delay(Math.random() * 2000));
      default:
        return rx.of(nietOndersteund(this.naam(), "Suggesties"));
    }
  }
}
