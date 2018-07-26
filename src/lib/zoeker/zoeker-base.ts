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
  type: "svg" | "font";
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
    public zoeker: string,
    public fouten: string[] = [],
    public resultaten: ZoekResultaat[] = [],
    public legende: Map<string, IconDescription> = Map()
  ) {}

  limiteerAantalResultaten(maxAantal: number): ZoekResultaten {
    if (this.resultaten.length >= maxAantal) {
      return new ZoekResultaten(
        this.zoeker,
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
  readonly type: string;
}

export interface StringZoekInput {
  readonly type: "string";
  readonly value: string;
}

export interface ZoekerBase {
  naam(): string;
  zoek$(input: ZoekInput): Observable<ZoekResultaten>;
}

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
