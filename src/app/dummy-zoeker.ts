import { Function1 } from "fp-ts/lib/function";
import { none, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { delay } from "rxjs/operators";

import * as ol from "../../projects/ng-kaart/src/lib/util/openlayers-compat";
import { rangeArray } from "../../projects/ng-kaart/src/lib/util/range";
import {
  nietOndersteund,
  ZoekAntwoord,
  Zoeker,
  ZoekInput,
  ZoekKaartResultaat,
  Zoekopdracht,
  Zoektype
} from "../../projects/ng-kaart/src/lib/zoeker";

const randomResultaat: Function1<string, ZoekKaartResultaat> = color => {
  const center = [100000 + Math.random() * 80000, 175000 + Math.random() * 30000] as [number, number];
  const radius = 2000 + Math.random() * 20000;
  return {
    geometry: new ol.geom.Circle(center, radius),
    extent: [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
    style: new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
        anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
        scale: 1,
        opacity: 0.75,
        src: require("material-design-icons/toggle/svg/production/ic_star_border_24px.svg")
      }),
      stroke: new ol.style.Stroke({
        color: color,
        width: 2
      }),
      fill: new ol.style.Fill({
        color: color + "40" // hack: veronderstelt hex kleur code
      })
    }),
    highlightStyle: new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
        anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
        scale: 1,
        opacity: 0.75,
        src: require("material-design-icons/toggle/svg/production/ic_star_24px.svg")
      }),
      stroke: new ol.style.Stroke({
        color: "yellow",
        width: 2
      }),
      fill: new ol.style.Fill({
        color: color + "40" // hack: veronderstelt hex kleur code
      })
    })
  };
};

/**
 * Een Zoeker die vrij random resultaten genereert.
 */
export class DummyZoeker implements Zoeker {
  constructor(private readonly _naam = "dummy", private readonly colorCode: string) {}

  naam() {
    return this._naam;
  }

  zoekresultaten$(zoekopdracht: Zoekopdracht): rx.Observable<ZoekAntwoord> {
    switch (zoekopdracht.zoektype) {
      case "Volledig":
        return this.zoek$(zoekopdracht.zoekpatroon);
      case "Suggesties":
        return this.suggesties$(zoekopdracht.zoekpatroon);
    }
  }

  help() {
    // Doe niks, geen help nodig.
  }

  zoek$(input: ZoekInput): rx.Observable<ZoekAntwoord> {
    switch (input.type) {
      case "string":
        const numResults = Math.floor(Math.pow(Math.random(), 1.2) * 5);
        const resultaat = (index: number) => ({
          partialMatch: Math.random() < 0.25,
          featureIdSuffix: index.toString(),
          omschrijving: `resultaat_${input.value}`,
          extraOmschrijving: some(`${this.naam()}_${index}`),
          bron: this.naam(),
          zoeker: this.naam(),
          kaartInfo: some(randomResultaat(this.colorCode)),
          icoon: { type: "font" as "font", name: "Du" },
          preferredPointZoomLevel: some(4 + Math.random() * 5)
        });
        const resultaten = rangeArray(numResults).map(resultaat);
        return rx.of(new ZoekAntwoord(this.naam(), "Volledig", [], resultaten));
      default:
        return rx.of(nietOndersteund(this.naam(), "Volledig"));
    }
  }

  suggesties$(input: ZoekInput): rx.Observable<ZoekAntwoord> {
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
          kaartInfo: some(randomResultaat(this.colorCode)),
          icoon: { type: "font" as "font", name: "Du" },
          preferredPointZoomLevel: some(4 + Math.random() * 5),
          zoektype: "Suggesties" as Zoektype
        });
        const resultaten = rangeArray(numResults).map(resultaat);
        return rx.of(new ZoekAntwoord(this.naam(), "Suggesties", [], resultaten)).pipe(delay(Math.random() * 2000));
      default:
        return rx.of(nietOndersteund(this.naam(), "Suggesties"));
    }
  }
}
