import * as array from "fp-ts/lib/Array";
import { Function1, Function2, Function3 } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { Ordering, sign } from "fp-ts/lib/Ordering";
import { insert, remove, StrMap } from "fp-ts/lib/StrMap";
import { Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";

export const geoJSONOptions = <ol.olx.format.GeoJSONOptions>{
  ignoreExtraDims: true,
  defaultDataProjection: undefined,
  featureProjection: undefined
};

export interface IconDescription {
  readonly type: "svg" | "font";
  readonly name: string;
}

export interface ZoekInput {
  readonly type: string; // We kunnen dit niet inperken omdat we niet alle zoekers kennen
  readonly [key: string]: any;
}

export interface StringZoekInput {
  readonly type: "string";
  readonly value: string;
}

export interface UrlZoekInput {
  readonly type: "url";
  readonly value: string;
}

export interface ZoekerHelpBoom {
  voegItemToe(text: string, ...titles: string[]);
}

export type Zoektype = "Volledig" | "Suggesties";

export interface Zoekopdracht {
  readonly zoekpatroon: ZoekInput;
  readonly zoektype: Zoektype;
  readonly zoekernamen: string[];
}

export interface Zoeker {
  naam(): string;
  help(helpBoom: ZoekerHelpBoom);
  zoekresultaten$(zoekopdracht: Zoekopdracht): rx.Observable<ZoekAntwoord>;
}

export type PrioriteitenOpZoekertype = StrMap<number>;

// Vreemde manier van werken, maar constructor heeft een type nodig
export const emptyPrioriteitenOpZoekertype: PrioriteitenOpZoekertype = remove("dummy", new StrMap({ dummy: 0 }));

const maybeInsertPrioriteit: Function3<Option<number>, Zoektype, PrioriteitenOpZoekertype, PrioriteitenOpZoekertype> = (
  maybePrio,
  zoektype,
  prioriteiten
) => maybePrio.map(prio => insert(zoektype, prio, prioriteiten)).getOrElse(prioriteiten);

export interface ZoekerMetPrioriteiten {
  readonly zoeker: Zoeker;
  readonly prioriteiten: PrioriteitenOpZoekertype;
}

export interface ZoekKaartResultaat {
  readonly geometry: ol.geom.Geometry;
  readonly extent: ol.Extent;
  readonly style: ol.style.Style;
  readonly highlightStyle: ol.style.Style;
}

export interface ZoekResultaat {
  readonly featureIdSuffix: string;
  readonly omschrijving: string;
  readonly bron: string;
  readonly zoeker: string;
  readonly kaartInfo: Option<ZoekKaartResultaat>;
  readonly icoon: IconDescription;
  readonly preferredPointZoomLevel: Option<number>;
  readonly extraOmschrijving: Option<string>;
}

export class ZoekAntwoord {
  constructor(
    readonly zoeker: string,
    readonly zoektype: Zoektype,
    readonly fouten: string[] = [],
    readonly resultaten: ZoekResultaat[] = [],
    readonly legende: Map<string, IconDescription> = Map()
  ) {}

  limiteerAantalResultaten(maxAantal: number): ZoekAntwoord {
    if (this.resultaten.length >= maxAantal) {
      return new ZoekAntwoord(
        this.zoeker,
        this.zoektype,
        this.fouten.concat([`Er werden meer dan ${maxAantal} resultaten gevonden, ` + `de eerste ${maxAantal} worden hier opgelijst`]),
        this.resultaten.slice(0, maxAantal),
        this.legende
      );
    } else {
      return this;
    }
  }
}

export const nietOndersteund: Function2<string, Zoektype, ZoekAntwoord> = (naam, zoektype) => new ZoekAntwoord(naam, zoektype);

export const zoekerMetPrioriteiten: (_1: Zoeker, _2?: number, _3?: number) => ZoekerMetPrioriteiten = (
  zoeker,
  volledigPrioriteit,
  suggestiesPrioriteit
) => ({
  zoeker: zoeker,
  prioriteiten: maybeInsertPrioriteit(
    fromNullable(volledigPrioriteit),
    "Volledig",
    maybeInsertPrioriteit(fromNullable(suggestiesPrioriteit), "Suggesties", emptyPrioriteitenOpZoekertype)
  )
});

export const zoekerMetNaam: Function1<string, Function1<ZoekerMetPrioriteiten[], Option<Zoeker>>> = naam => zmps =>
  array.findFirst(zmps, zmp => zmp.zoeker.naam() === naam).map(zmp => zmp.zoeker);

// De resultaten worden getoond volgens een bepaalde hiërarchie
// - Eerst wordt er gesorteerd volgens zoekernaam.
//   Het is mogelijk dat hier bron moet komen ipv zoekernaam. Bron is namelijk een fijner niveau. Als dat zo is,
//   dan moet de bronprioriteit nog geconfigureerd worden. Voor de implementatie van deze functie maakt dat niet, maar wel
//   voor die van de prioriteitenGetter.
export function zoekResultaatOrdering(
  input: string,
  prioriteitenGetter: Function1<ZoekResultaat, number>
): Function2<ZoekResultaat, ZoekResultaat, Ordering> {
  return (a, b) => {
    const prioA = prioriteitenGetter(a);
    const prioB = prioriteitenGetter(b);
    if (prioA === prioB) {
      return compareOpInhoud(a, b, input);
    } else {
      return sign(prioA - prioB);
    }
  };
}

//  - Dan wordt er gekeken naar de resultaten in de tekst (als de 3 tekens matchen met de 3 eerste tekens van het resultaat)
function compareOpInhoud(a: ZoekResultaat, b: ZoekResultaat, input: string): Ordering {
  const aMatchesInput = matchesInput(a, input);
  const bMatchesInput = matchesInput(b, input);

  if (aMatchesInput) {
    if (bMatchesInput) {
      // Zowel a als b matchen met de input, doe op volgend niveau.
      return sign(a.omschrijving.localeCompare(b.omschrijving));
    } else {
      return -1;
    }
  } else if (bMatchesInput) {
    return 1;
  } else {
    // Noch a noch b matchen met de input, vergelijk heel het resultaat.
    return sign(a.omschrijving.localeCompare(b.omschrijving));
  }
}

function matchesInput(res: ZoekResultaat, input: string): boolean {
  return res.omschrijving.toLowerCase().startsWith(input.toLowerCase());
}

export const StringZoekInput: Function1<string, StringZoekInput> = value => ({ type: "string", value: value });
export const UrlZoekInput: Function1<string, UrlZoekInput> = value => ({ type: "url", value: value });
