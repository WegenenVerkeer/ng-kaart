import { option } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";
import * as rx from "rxjs";

import { Zoeker } from "../zoeker";

// Gegeven een bronnaam, geef een Observable van categorieën. Gewrapt in Option voor het geval dat er geen categorieën
// zijn.
export type CategorieObsProvider = Function1<string, option.Option<rx.Observable<string[]>>>;

export interface AlleLagenZoekerService extends Zoeker {
  bronnen$: rx.Observable<string[]>;
  categorie$Provider: CategorieObsProvider;
}
