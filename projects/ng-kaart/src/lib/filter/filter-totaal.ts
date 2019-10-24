import { Curried2, Function1, Lazy, Predicate, Refinement } from "fp-ts/lib/function";

import * as matchers from "../util/matchers";

export type FilterTotaal = TotaalOpTeHalen | TotaalOpgehaald | TeVeelData | TotaalOphalenMislukt;

export interface TeVeelData {
  readonly kind: "TeVeelData";
  readonly collectionTotaal: number;
}

export interface TotaalOpTeHalen {
  readonly kind: "TotaalOpTeHalen";
}

export interface TotaalOpgehaald {
  readonly kind: "TotaalOpgehaald";
  readonly collectionTotaal: number; // Ongeacht de actieve filter
  readonly totaal: number; // Rekening houdend met de filter
}

export interface TotaalOphalenMislukt {
  readonly kind: "TotaalOphalenMislukt";
  readonly foutmelding: string;
}

export const teVeelData: Function1<number, FilterTotaal> = collectionTotaal => ({
  kind: "TeVeelData",
  collectionTotaal: collectionTotaal
});

export const totaalOpTeHalen: Lazy<FilterTotaal> = () => ({ kind: "TotaalOpTeHalen" });

export const totaalOpgehaald: Curried2<number, number, FilterTotaal> = collectionTotaal => totaal => ({
  kind: "TotaalOpgehaald",
  collectionTotaal: collectionTotaal,
  totaal: totaal
});

export const totaalOphalenMislukt: Function1<string, TotaalOphalenMislukt> = foutmelding => ({
  kind: "TotaalOphalenMislukt",
  foutmelding: foutmelding
});

export const isTeVeelData: Refinement<FilterTotaal, TeVeelData> = (filterTotaal): filterTotaal is TeVeelData =>
  filterTotaal.kind === "TeVeelData";
export const isTotaalOpTeHalen: Refinement<FilterTotaal, TotaalOpTeHalen> = (filterTotaal): filterTotaal is TotaalOpTeHalen =>
  filterTotaal.kind === "TotaalOpTeHalen";
export const isTotaalOpgehaald: Refinement<FilterTotaal, TotaalOpgehaald> = (filterTotaal): filterTotaal is TotaalOpgehaald =>
  filterTotaal.kind === "TotaalOpgehaald";
export const isTotaalTerminaal: Predicate<FilterTotaal> = filterTotaal =>
  filterTotaal.kind === "TeVeelData" || filterTotaal.kind === "TotaalOpgehaald" || filterTotaal.kind === "TotaalOphalenMislukt";
export const isTotaalMislukt: Refinement<FilterTotaal, TotaalOphalenMislukt> = (filterTotaal): filterTotaal is TotaalOphalenMislukt =>
  filterTotaal.kind === "TotaalOphalenMislukt";

export const match: <A>(_: matchers.FullKindMatcher<FilterTotaal, A>) => Function1<FilterTotaal, A> = matchers.matchKind;
