import { Set } from "immutable";
import * as rx from "rxjs";

import { ZoekerBase } from "../zoeker-base";

export interface ExterneWmsZoekerService extends ZoekerBase {
  bronnen$: rx.Observable<Set<string>>;
}
