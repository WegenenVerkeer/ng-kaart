import { Function1 } from "fp-ts/lib/function";

// Dit is een handige abstractie om te gebruiken in een pijplijn met een scan of fold erin.
// Sommige elementeb die moeten resulteren in toevoegen worden ingepakt in Add. Diegene die moeten verwijden
// in Remove.

export interface AddRemove<T> {
  readonly type: "+" | "-";
  readonly value: T;
}

export const Add: <T>(_: T) => AddRemove<T> = value => ({ type: "+", value: value });
export const Remove: <T>(_: T) => AddRemove<T> = value => ({ type: "-", value: value });
export const fold: <T, R>(_1: AddRemove<T>, _2: Function1<T, R>, _3: Function1<T, R>) => R = (ar, plus, min) =>
  ar.type === "+" ? plus(ar.value) : min(ar.value);
