import { Set } from "immutable";
import * as rx from "rxjs";

import { Zoeker } from "../zoeker";

export interface ExterneWmsZoekerService extends Zoeker {
  bronnen$: rx.Observable<Set<string>>;
}
