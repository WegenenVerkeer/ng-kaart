import { array, option, ordering, record } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";

import * as ol from "../util/openlayers-compat";

export const geoJSONOptions = <ol.format.GeoJSONOptions>{
  ignoreExtraDims: true,
  defaultDataProjection: undefined,
  featureProjection: undefined,
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

export type PrioriteitenOpZoekertype = Record<string, number>;

export const emptyPrioriteitenOpZoekertype: PrioriteitenOpZoekertype = {};

const maybeInsertPrioriteit: (
  maybePrio: option.Option<number>,
  zoektype: Zoektype,
  prioriteiten: PrioriteitenOpZoekertype
) => PrioriteitenOpZoekertype = (maybePrio, zoektype, prioriteiten) =>
  pipe(
    maybePrio,
    option.map((prio) => record.insertAt(zoektype, prio)(prioriteiten)),
    option.getOrElse(() => prioriteiten)
  );

export interface Weergaveopties {
  readonly prioriteiten: PrioriteitenOpZoekertype;
  readonly toonIcoon: boolean;
  readonly toonOppervlak: boolean;
}

export interface ZoekerMetWeergaveopties extends Weergaveopties {
  readonly zoeker: Zoeker;
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
  readonly kaartInfo: option.Option<ZoekKaartResultaat>;
  readonly icoon: IconDescription;
  readonly preferredPointZoomLevel: option.Option<number>;
  readonly extraOmschrijving: option.Option<string>;
}

export class ZoekAntwoord {
  constructor(
    readonly zoeker: string,
    readonly zoektype: Zoektype,
    readonly fouten: string[] = [],
    readonly resultaten: ZoekResultaat[] = [],
    readonly legende: Map<string, IconDescription> = new Map()
  ) {}

  limiteerAantalResultaten(maxAantal: number): ZoekAntwoord {
    if (this.resultaten.length >= maxAantal) {
      return new ZoekAntwoord(
        this.zoeker,
        this.zoektype,
        this.fouten.concat([
          `Er werden meer dan ${maxAantal} resultaten gevonden, ` +
            `de eerste ${maxAantal} worden hier opgelijst`,
        ]),
        this.resultaten.slice(0, maxAantal),
        this.legende
      );
    } else {
      return this;
    }
  }
}

export const nietOndersteund: (
  naam: string,
  zoektype: Zoektype
) => ZoekAntwoord = (naam, zoektype) => new ZoekAntwoord(naam, zoektype);

const nonNegative = option.fromPredicate((n: number) => n >= 0);

export const zoekerMetPrioriteiten: (
  zoeker: Zoeker,
  volledigPrioriteit: number,
  suggestiesPrioriteit: number,
  toonIcoon?: boolean,
  toonOppervlak?: boolean
) => ZoekerMetWeergaveopties = (
  zoeker,
  volledigPrioriteit,
  suggestiesPrioriteit,
  toonIcoon = true,
  toonOppervlak = true
) => ({
  zoeker: zoeker,
  prioriteiten: maybeInsertPrioriteit(
    nonNegative(volledigPrioriteit),
    "Volledig",
    maybeInsertPrioriteit(
      nonNegative(suggestiesPrioriteit),
      "Suggesties",
      emptyPrioriteitenOpZoekertype
    )
  ),
  toonIcoon: toonIcoon,
  toonOppervlak: toonOppervlak,
});

export const zoekerMetNaam: (
  naam: string
) => (zmps: ZoekerMetWeergaveopties[]) => option.Option<Zoeker> = (naam) => (
  zmps
) =>
  pipe(
    zmps,
    array.findFirst((zmp) => zmp.zoeker.naam() === naam),
    option.map((zmp) => zmp.zoeker)
  );

// De resultaten worden getoond volgens een bepaalde hiërarchie
// - Eerst wordt er gesorteerd volgens zoekernaam.
//   Het is mogelijk dat hier bron moet komen ipv zoekernaam. Bron is namelijk een fijner niveau. Als dat zo is,
//   dan moet de bronprioriteit nog geconfigureerd worden. Voor de implementatie van deze functie maakt dat niet, maar wel
//   voor die van de prioriteitenGetter.
export function zoekResultaatOrdering(
  input: string,
  prioriteitenGetter: (z: ZoekResultaat) => number
): (a: ZoekResultaat, b: ZoekResultaat) => ordering.Ordering {
  return (a, b) => {
    const prioA = prioriteitenGetter(a);
    const prioB = prioriteitenGetter(b);
    if (prioA === prioB) {
      return compareOpInhoud(a, b, input);
    } else {
      return ordering.sign(prioA - prioB);
    }
  };
}

//  - Dan wordt er gekeken naar de resultaten in de tekst (als de 3 tekens matchen met de 3 eerste tekens van het resultaat)
function compareOpInhoud(
  a: ZoekResultaat,
  b: ZoekResultaat,
  input: string
): ordering.Ordering {
  const aMatchesInput = matchesInput(a, input);
  const bMatchesInput = matchesInput(b, input);

  if (aMatchesInput) {
    if (bMatchesInput) {
      // Zowel a als b matchen met de input, doe op volgend niveau.
      return ordering.sign(a.omschrijving.localeCompare(b.omschrijving));
    } else {
      return -1;
    }
  } else if (bMatchesInput) {
    return 1;
  } else {
    // Noch a noch b matchen met de input, vergelijk heel het resultaat.
    return ordering.sign(a.omschrijving.localeCompare(b.omschrijving));
  }
}

function matchesInput(res: ZoekResultaat, input: string): boolean {
  return res.omschrijving.toLowerCase().startsWith(input.toLowerCase());
}

export const StringZoekInput: (value: string) => StringZoekInput = (value) => ({
  type: "string",
  value: value,
});
export const UrlZoekInput: (value: string) => UrlZoekInput = (value) => ({
  type: "url",
  value: value,
});

export const VolledigeZoekOpdracht: (
  zoekernamen: string[],
  zoekpatroon: ZoekInput
) => Zoekopdracht = (zoekernamen, zoekpatroon) => ({
  zoektype: "Volledig",
  zoekernamen,
  zoekpatroon,
});

export const SuggestiesZoekOpdracht: (
  zoekernamen: string[],
  zoekpatroon: ZoekInput
) => Zoekopdracht = (zoekernamen, zoekpatroon) => ({
  zoektype: "Suggesties",
  zoekernamen,
  zoekpatroon,
});
