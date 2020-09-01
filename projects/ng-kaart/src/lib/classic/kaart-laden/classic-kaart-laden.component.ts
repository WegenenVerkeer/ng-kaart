import {
  AfterViewInit,
  Component,
  EventEmitter,
  Injector,
  Input,
  Output,
} from "@angular/core";
import * as rx from "rxjs";
import {
  distinctUntilChanged,
  distinctUntilKeyChanged,
  tap,
} from "rxjs/operators";

import * as prt from "../../kaart/kaart-protocol";
import { KaartLoadingUISelector } from "../../kaart/loading/kaart-loading.component";
import { ofType } from "../../util";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";
import { BusyMsg } from "../messages";

@Component({
  selector: "awv-kaart-laden",
  template: "",
})
export class ClassicKaartLadenComponent extends ClassicUIElementSelectorDirective {
  /**
   * Is de progressbar van ng-kaart bezig? True indien userBusy op true staat of indien er data geladen wordt.
   */
  @Output()
  busy: EventEmitter<boolean> = new EventEmitter<boolean>();

  /**
   * Zet de progress bar aan, moet ook weer expliciet afgezet worden.
   */
  @Input()
  set forceProgressBar(param: boolean) {
    this.kaart.dispatch(prt.ZetForceProgressBarCmd(param));
  }

  /** Toon de default progress bar als er features geladen worden? Default true. Indien false rendert ng-kaart zelf geen progressbar.
   * Je kan wel nog altijd weten of ng-kaart 'bezig' is via de busy output.
   */
  @Input()
  set defaultProgressbarEnabled(param: boolean) {
    this.kaart.dispatch(
      prt.ZetUiElementOpties(KaartLoadingUISelector, {
        defaultProgressBar: param,
      })
    );
  }

  constructor(injector: Injector) {
    super(KaartLoadingUISelector, injector);
    this.runInViewReady(
      rx.defer(() =>
        this.kaart.kaartClassicSubMsg$.pipe(
          ofType<BusyMsg>("Busy"),
          distinctUntilKeyChanged("busy"),
          tap((value) => {
            this.busy.emit(value.busy);
          })
        )
      )
    );
  }
}
