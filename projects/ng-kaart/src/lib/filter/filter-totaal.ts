import { Curried2, Function1, Lazy, Predicate, Refinement } from "fp-ts/lib/function";

export type FilterTotaal = TotaalOpTeHalen | TotaalOpgehaald | TeVeelData | TotaalOphalenMislukt;

export interface TeVeelData {
  readonly type: "TeVeelData";
  readonly collectionTotaal: number;
}

export interface TotaalOpTeHalen {
  readonly type: "TotaalOpTeHalen";
}

export interface TotaalOpgehaald {
  readonly type: "TotaalOpgehaald";
  readonly collectionTotaal: number;
  readonly totaal: number;
}

export interface TotaalOphalenMislukt {
  readonly type: "TotaalOphalenMislukt";
  readonly foutmelding: string;
}

export const teVeelData: Function1<number, FilterTotaal> = collectionTotaal => ({
  type: "TeVeelData",
  collectionTotaal: collectionTotaal
});

export const totaalOpTeHalen: Lazy<FilterTotaal> = () => ({ type: "TotaalOpTeHalen" });

export const totaalOpgehaald: Curried2<number, number, FilterTotaal> = collectionTotaal => totaal => ({
  type: "TotaalOpgehaald",
  collectionTotaal: collectionTotaal,
  totaal: totaal
});

export const totaalOphalenMislukt: Function1<string, TotaalOphalenMislukt> = foutmelding => ({
  type: "TotaalOphalenMislukt",
  foutmelding: foutmelding
});

export const isTotaalOpgehaald: Refinement<FilterTotaal, TotaalOpgehaald> = (filterTotaal): filterTotaal is TotaalOpgehaald =>
  filterTotaal.type === "TotaalOpgehaald";
export const isTotaalTerminaal: Predicate<FilterTotaal> = filterTotaal =>
  filterTotaal.type === "TeVeelData" || filterTotaal.type === "TotaalOpgehaald" || filterTotaal.type === "TotaalOphalenMislukt";
export const isTotaalMislukt: Refinement<FilterTotaal, TotaalOphalenMislukt> = (filterTotaal): filterTotaal is TotaalOphalenMislukt =>
  filterTotaal.type === "TotaalOphalenMislukt";
