import { Function1, Predicate } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";

import { AbstractRepresentatieService } from "./zoeker-representatie.service";

export const geoJSONOptions = <ol.olx.format.GeoJSONOptions>{
  ignoreExtraDims: true,
  defaultDataProjection: undefined,
  featureProjection: undefined
};

export interface IconDescription {
  readonly type: "svg" | "font";
  readonly name: string;
}

export interface ZoekKaartResultaat {
  readonly geometry: ol.geom.Geometry;
  readonly extent: ol.Extent;
  readonly style: ol.style.Style;
  readonly highlightStyle: ol.style.Style;
}

export interface ZoekResultaat {
  readonly partialMatch: boolean;
  readonly index: number;
  readonly omschrijving: string;
  readonly bron: string;
  readonly zoeker: string;
  readonly kaartInfo: Option<ZoekKaartResultaat>;
  readonly icoon: IconDescription;
  readonly preferredPointZoomLevel: Option<number>;
}

export class ZoekResultaten {
  constructor(
    public readonly zoeker: string,
    public readonly prioriteit: number,
    public readonly fouten: string[] = [],
    public readonly resultaten: ZoekResultaat[] = [],
    public readonly legende: Map<string, IconDescription> = Map()
  ) {}

  limiteerAantalResultaten(maxAantal: number): ZoekResultaten {
    if (this.resultaten.length >= maxAantal) {
      return new ZoekResultaten(
        this.zoeker,
        this.prioriteit,
        this.fouten.concat([`Er werden meer dan ${maxAantal} resultaten gevonden, ` + `de eerste ${maxAantal} worden hier opgelijst`]),
        this.resultaten.slice(0, maxAantal),
        this.legende
      );
    } else {
      return this;
    }
  }
}

export interface ZoekInput {
  readonly type: string; // We kunnen dit niet inperken omdat we niet alle zoekers kennen
  readonly [key: string]: any;
}

export interface StringZoekInput {
  readonly type: "string";
  readonly value: string;
}

export type Zoektype = "Volledig" | "Vlug";

export interface ZoekOpdracht {
  readonly zoekpatroon: ZoekInput;
  readonly zoektype: Zoektype;
}

export interface Zoeker {
  naam(): string;
  zoekPrioriteit(): number;
  suggestiePrioriteit(): number;
  zoek$(input: ZoekInput): Observable<ZoekResultaten>;
  suggesties$(input: string): Observable<ZoekResultaten>;
}

export abstract class ZoekerBase {
  constructor(private readonly _naam: string, private readonly _zoekPrioriteit: number, private readonly _suggestiePrioriteit: number) {}

  naam(): string {
    return this._naam;
  }

  zoekPrioriteit(): number {
    return this._zoekPrioriteit;
  }

  suggestiePrioriteit(): number {
    return this._suggestiePrioriteit;
  }
}

export const zoekerMetNaam: Function1<string, Predicate<Zoeker>> = naam => zoeker => zoeker.naam() === naam;

// De resultaten worden getoond volgens een bepaalde hiërarchie
// - Eerst wordt er gesorteerd volgens bron
export function compareResultaten(
  a: ZoekResultaat,
  b: ZoekResultaat,
  input: string,
  zoekerRepresentatie: AbstractRepresentatieService
): number {
  const bronA = zoekerRepresentatie.bronNaarNummer(a);
  const bronB = zoekerRepresentatie.bronNaarNummer(b);
  if (bronA === bronB) {
    return compareOpInhoud(a, b, input);
  } else {
    return bronA - bronB;
  }
}

//  - Dan wordt er gekeken naar de resultaten in de tekst (als de 3 tekens matchen met de 3 eerste tekens van het resultaat)
function compareOpInhoud(a: ZoekResultaat, b: ZoekResultaat, input: string): number {
  const aMatchesInput = matchesInput(a, input);
  const bMatchesInput = matchesInput(b, input);

  if (aMatchesInput) {
    if (bMatchesInput) {
      // Zowel a als b matchen met de input, doe op volgend niveau.
      return a.omschrijving.localeCompare(b.omschrijving);
    } else {
      return -1;
    }
  } else if (bMatchesInput) {
    return 1;
  } else {
    // Noch a als b matchen met de input, vergelijk heel het resultaat.
    return a.omschrijving.localeCompare(b.omschrijving);
  }
}

function matchesInput(res: ZoekResultaat, input: string): boolean {
  return res.omschrijving.toLowerCase().startsWith(input.toLowerCase());
}
