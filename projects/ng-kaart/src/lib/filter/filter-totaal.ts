import { Predicate, Refinement } from "fp-ts/lib/function";

export type FilterTotaal = TotaalOpTeHalen | TotaalOpgehaald | TeVeelData;

export interface TeVeelData {
  readonly type: "TeVeelData";
}

export interface TotaalOpTeHalen {
  readonly type: "TotaalOpTeHalen";
}

export interface TotaalOpgehaald {
  readonly type: "TotaalOpgehaald";
  readonly totaal: number;
}

export const teVeelData: () => FilterTotaal = () => ({ type: "TeVeelData" });
export const totaalOpTeHalen: () => FilterTotaal = () => ({ type: "TotaalOpTeHalen" });
export const totaalOpgehaald: (number) => FilterTotaal = totaal => ({
  type: "TotaalOpgehaald",
  totaal: totaal
});

export const isTotaalOpgehaald: Refinement<FilterTotaal, TotaalOpgehaald> = (filterTotaal): filterTotaal is TotaalOpgehaald =>
  filterTotaal.type === "TotaalOpgehaald";
export const isTotaalTerminaal: Predicate<FilterTotaal> = filterTotaal =>
  filterTotaal.type === "TeVeelData" || filterTotaal.type === "TotaalOpgehaald";
