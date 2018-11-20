import { NgZone, OnInit } from "@angular/core";
import { none, some } from "fp-ts/lib/Option";
import { takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../util/observe-on-angular";
import { ofType, skipOlder } from "../util/operators";
import { containsText } from "../util/option";

import { KaartChildComponentBase } from "./kaart-child-component-base";
import { ActieveModusAangepastMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";

export abstract class KaartModusComponent extends KaartChildComponentBase implements OnInit {
  protected actief = false;

  constructor(protected readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);
  }

  abstract modus(): string;

  abstract isDefaultModus(): boolean;

  abstract activeer(active: boolean);

  ngOnInit() {
    super.ngOnInit();

    this.internalMessage$
      .pipe(
        ofType<ActieveModusAangepastMsg>("ActieveModus"), //
        observeOnAngular(this.zone),
        takeUntil(this.destroying$), // autounsubscribe bij destroy component
        skipOlder()
      )
      .subscribe(msg => {
        if (msg.modus.isNone()) {
          // als er geen modus gezet is, is dit de default modus, activeer onszelf
          if (!this.actief && this.isDefaultModus()) {
            this.activeer(true);
          }
        } else if (!containsText(msg.modus, this.modus())) {
          // aanvraag tot andere modus, disable deze modus
          if (this.actief) {
            this.activeer(false);
          }
        }
      });
  }

  publiceerActivatie() {
    this.dispatch(prt.ZetActieveModusCmd(some(this.modus())));
  }

  publiceerDeactivatie() {
    this.dispatch(prt.ZetActieveModusCmd(none));
  }
}
