import { NgZone } from "@angular/core";
import { none, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { filter, map, shareReplay, switchMap } from "rxjs/operators";

import { observeOnAngular } from "../util/observe-on-angular";
import { containsText } from "../util/option";

import { KaartChildComponentBase } from "./kaart-child-component-base";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";

export abstract class KaartModusComponent extends KaartChildComponentBase {
  private actief = false;

  constructor(protected readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);

    this.bindToLifeCycle(
      this.initialising$.pipe(
        switchMap(() => this.modelChanges.actieveModus$),
        observeOnAngular(zone)
      )
    ).subscribe(maybeModus => {
      if ((maybeModus.isNone() && this.isDefaultModus()) || containsText(maybeModus, this.modus())) {
        if (!this.actief) {
          this.maakActief();
        }
      } else {
        // aanvraag tot andere modus, disable deze modus
        if (this.actief) {
          this.maakInactief();
        }
      }
    });
  }

  abstract modus(): string;

  protected modusOpties$<A>(): rx.Observable<A> {
    return this.modelChanges.uiElementOpties$.pipe(
      filter(optie => optie.naam === this.modus()),
      map(o => o.opties as A),
      shareReplay(1)
    );
  }

  protected isDefaultModus(): boolean {
    return false;
  }

  protected activeer() {}

  protected deactiveer() {}

  isActief() {
    return this.actief;
  }

  toggle() {
    if (this.actief) {
      this.zetModeAf();
    } else {
      this.zetModeAan();
    }
  }

  zetModeAf() {
    if (this.actief) {
      this.maakInactief();
      this.publiceerDeactivatie();
    }
  }

  zetModeAan() {
    if (!this.actief) {
      this.publiceerActivatie();
      this.maakActief();
    }
  }

  private maakActief() {
    this.actief = true; // wees voorzichtig met het aanpassen van de volgorde hier
    this.activeer();
  }

  private maakInactief() {
    this.actief = false; // wees voorzichtig met het aanpassen van de volgorde hier
    this.deactiveer();
  }

  private publiceerActivatie() {
    this.dispatch(prt.ZetActieveModusCmd(some(this.modus())));
  }

  private publiceerDeactivatie() {
    this.dispatch(prt.ZetActieveModusCmd(none));
  }
}
