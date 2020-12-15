import {
  Component,
  EventEmitter,
  Injector,
  Input,
  Output,
} from "@angular/core";

import { pipe } from "fp-ts/lib/pipeable";
import { option } from "fp-ts";
import * as clr from "../../stijl/colour";

import {
  MultiMetenOpties,
  MultiMetenUiSelector,
} from "../../kaart/meten/kaart-multi-meten.component";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";

import * as val from "../webcomponent-support/params";
import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicMsg, DummyMsg } from "../messages";
import { classicMsgSubscriptionCmdOperator } from "../kaart-classic.component";
import { DrawOpsCmd } from "../../kaart/kaart-protocol-commands";
import { DrawOps } from "../../kaart/tekenen/tekenen-model";
import { RoutingRapport } from "../../kaart/tekenen/teken.api";

/**
 * De component zorgt voor een knop aan de rechterkant waarmee een meet-tool geactiveerd kan worden.
 */
@Component({
  selector: "awv-kaart-multi-meet-knop",
  template: "",
})
export class ClassicMultiMetenComponent extends ClassicUIElementSelectorDirective {
  _tekenKleurCode = clr.kleurcodeValue(clr.zwartig);
  _toonInfoBoodschap = true;
  _metRouting = false;
  _keuzemogelijkheidTonen = false;

  /** Dit moet dus effectief een code zijn in het formaat #rrggbb(tt?). De string 'white' bijv. is niet ok. */
  @Input()
  set tekenKleurCode(param: string) {
    this._tekenKleurCode = val.str(param, this._tekenKleurCode);
  }

  /** Mag de infobox met de lengte en evt oppervlakte getoond worden? */
  @Input()
  set toonInfoBoodschap(param: boolean) {
    this._toonInfoBoodschap = val.bool(param, this._toonInfoBoodschap);
  }

  /** moet std routing via de weg gebeuren? */
  @Input()
  set metRouting(param: boolean) {
    this._metRouting = val.bool(param, this._metRouting);
  }

  /** moet de gebruiker kunnen kiezen tussen  rechte lijnen en via de weg? */
  @Input()
  set keuzemogelijkheidTonen(param: boolean) {
    this._keuzemogelijkheidTonen = val.bool(
      param,
      this._keuzemogelijkheidTonen
    );
  }

  @Input()
  set drawCommand(drawOps: DrawOps) {
    this.kaart.dispatch(DrawOpsCmd(drawOps));
  }

  @Output()
  routingRapport: EventEmitter<RoutingRapport> = new EventEmitter();

  constructor(injector: Injector) {
    super(MultiMetenUiSelector, injector);
  }

  protected opties(): MultiMetenOpties {
    return {
      markColour: pipe(
        clr.toKleur("naam", this._tekenKleurCode),
        option.getOrElse(() => clr.zwartig)
      ),
      useRouting: this._metRouting,
      showInfoMessage: this._toonInfoBoodschap,
      connectionSelectable: this._keuzemogelijkheidTonen,
    };
  }

  ngOnInit() {
    super.ngOnInit();

    this.bindToLifeCycle(
      this.kaart.kaartClassicSubMsg$.lift(
        classicMsgSubscriptionCmdOperator(
          this.kaart.dispatcher,
          prt.RoutingrapportSubscription((routingRapport) => {
            this.routingRapport.emit(routingRapport);
            return KaartClassicMsg(DummyMsg());
          })
        )
      )
    ).subscribe();
  }
}
