import { NgZone } from "@angular/core";
import { identity } from "fp-ts/lib/function";
import { none, some } from "fp-ts/lib/Option";
import * as rx from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, mapTo, sample, share, shareReplay, skipUntil, tap } from "rxjs/operators";

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
      shareReplay(1) // wordt in een switchMap subscribed (herhaalde malen)
    );

    this.wordtActief$ = this.isActief$.pipe(
      filter(identity),
      mapTo(null),
      share()
    );
    this.wordtInactief$ = this.isActief$.pipe(
      filter(actief => actief === false),
      mapTo(null),
      skipUntil(this.wordtActief$), // kan maar inactief worden indien ooit actief
      share()
    );

    const internIsActief$ = this.isActief$.pipe(
      sample(rx.merge(this.zetActiefSubj, this.toggleActiefSubj)),
      debounceTime(10) // distinctUntilChanged is niet goed want mogelijk intern aan en extern af (of omgekeerd)
    );

    this.runInViewReady(
      // Laat de buitenwereld weten dat we (in)actief worden
      internIsActief$.pipe(tap(isActief => (isActief ? this.publiceerActivatie() : this.publiceerDeactivatie())))
    );
  }

  abstract modus(): string;

  protected modusOpties$<A extends object>(init: A): rx.Observable<A> {
    return this.accumulatedOpties$(this.modus(), init);
  }

  protected isDefaultModus(): boolean {
    return false;
  }

  toggle() {
    this.toggleActiefSubj.next(null);
  }

  zetModeAf() {
    this.zetActiefSubj.next(false);
  }

  zetModeAan() {
    this.zetActiefSubj.next(true);
  }

  private publiceerActivatie() {
    this.dispatch(prt.ZetActieveModusCmd(some(this.modus())));
  }

  private publiceerDeactivatie() {
    this.dispatch(prt.ZetActieveModusCmd(none));
  }
}
