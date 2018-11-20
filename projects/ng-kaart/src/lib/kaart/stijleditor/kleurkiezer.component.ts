import { ChangeDetectionStrategy, Component, ElementRef, NgZone, QueryList, ViewChildren, ViewEncapsulation } from "@angular/core";
import * as rx from "rxjs";
import { delay, filter, map, mapTo, share, shareReplay, skipUntil, startWith, switchMap, take, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { negate } from "../../util/thruth";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";

import { KiesbareKleur } from "./model";

@Component({
  selector: "awv-kleurkiezer",
  templateUrl: "./kleurkiezer.component.html",
  styleUrls: ["./kleurkiezer.component.scss"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KleurkiezerComponent {
  readonly paletKleuren$: rx.Observable<KiesbareKleur[]>;
}
