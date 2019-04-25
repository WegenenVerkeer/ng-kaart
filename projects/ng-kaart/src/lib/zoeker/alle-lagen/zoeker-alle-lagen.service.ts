import * as rx from "rxjs";

import { Zoeker } from "../zoeker";

export interface AlleLagenZoekerService extends Zoeker {
  categorieen$: rx.Observable<string[]>;
}
