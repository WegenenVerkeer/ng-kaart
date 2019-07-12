import { NgZone } from "@angular/core";
import { identity } from "fp-ts/lib/function";
import { none, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, mapTo, sample, share, skipUntil, tap } from "rxjs/operators";

import { scan2 } from "../util";

import { KaartChildComponentBase } from "./kaart-child-component-base";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";

export abstract class KaartModusComponent extends KaartChildComponentBase {
  private readonly zetActiefSubj: rx.Subject<boolean> = new rx.Subject<boolean>();
  private readonly toggleActiefSubj: rx.Subject<null> = new rx.Subject<null>();
  readonly isActief$: rx.Observable<boolean>;
  protected readonly wordtActief$: rx.Observable<null>;
  protected readonly wordtInactief$: rx.Observable<null>;

  constructor(protected readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);

    const externIsActief$ = this.modelChanges.actieveModus$.pipe(
      map(maybeModus => maybeModus.foldL(() => this.isDefaultModus(), modus => modus === this.modus()))
    );

    this.isActief$ = scan2(
      rx.merge(externIsActief$, this.zetActiefSubj),
      this.toggleActiefSubj,
      (_, actief) => actief,
      activiteit => !activiteit,
      false
    ).pipe(
      distinctUntilChanged(),
      share()
    );

    this.wordtActief$ = this.isActief$.pipe(
      filter(identity),
      mapTo(null)
    );
    this.wordtInactief$ = this.isActief$.pipe(
      filter(actief => actief === false),
      mapTo(null),
      skipUntil(this.wordtActief$) // kan maar inactief worden indien ooit actief
    );

    const internIsActief$ = this.isActief$.pipe(
      sample(rx.merge(this.zetActiefSubj, this.toggleActiefSubj)),
      distinctUntilChanged()
    );

    this.runInViewReady(
      rx.merge(
        // Deze mag weg wanneer de afgeleiden op de observable luisteren
        this.isActief$.pipe(tap(isActief => (isActief ? this.onActivatie() : this.onDeactivatie()))),
        // Laat de buitenwereld weten dat we (in)actief worden
        internIsActief$.pipe(tap(isActief => (isActief ? this.publiceerActivatie() : this.publiceerDeactivatie())))
      )
    );
  }

  abstract modus(): string;

  protected modusOpties$<A extends object>(init: A): rx.Observable<A> {
    return this.accumulatedOpties$(this.modus(), init);
  }

  protected isDefaultModus(): boolean {
    return false;
  }

  protected onActivatie() {}

  protected onDeactivatie() {}

  // isActief() {
  //   return this.actief;
  // }

  toggle() {
    this.toggleActiefSubj.next(null);
    // if (this.actief) {
    //   this.zetModeAf();
    // } else {
    //   this.zetModeAan();
    // }
  }

  zetModeAf() {
    this.zetActiefSubj.next(false);
    // if (this.actief) {
    //   this.maakInactief();
    //   this.publiceerDeactivatie();
    // }
  }

  zetModeAan() {
    this.zetActiefSubj.next(true);
    // if (!this.actief) {
    //   this.publiceerActivatie();
    //   this.maakActief();
    // }
  }

  // private maakActief() {
  //   this.actief = true; // wees voorzichtig met het aanpassen van de volgorde hier
  //   this.onActivatie();
  // }

  // private maakInactief() {
  //   this.actief = false; // wees voorzichtig met het aanpassen van de volgorde hier
  //   this.onDeactivatie();
  // }

  private publiceerActivatie() {
    this.dispatch(prt.ZetActieveModusCmd(some(this.modus())));
  }

  private publiceerDeactivatie() {
    this.dispatch(prt.ZetActieveModusCmd(none));
  }
}
