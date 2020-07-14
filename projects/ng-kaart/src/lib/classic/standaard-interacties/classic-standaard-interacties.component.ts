import { Component, Injector, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewEncapsulation } from "@angular/core";
import * as rx from "rxjs";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { ClassicBaseDirective } from "../classic-base.directive";
import * as val from "../webcomponent-support/params";

/**
 * Maakt de kaart interactief. Laat toe dat er gezoomd (muiswiel, pinch), verschoven en gedraaid kan worden.
 *
 * Gebruik dit niet als je een statische kaart wil tonen.
 */
@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicStandaardInteractiesComponent extends ClassicBaseDirective implements OnDestroy, OnChanges, OnInit {
  private standaardInteractieToegevoegd = false;
  _focusVoorZoom = false;
  _rotatie = false;

  /**
   * Wanneer dit aangezet wordt, moet de kaartcomponent eerst de focus krijgen van de browser vooraleer die events
   * begint te verwerken. De focus kan gegeven worden door bijvoorbeeld ergens in de div met de kaart te klikken.
   *
   * Wanneer die niet aanstaat (standaard), zal de kaart beginnen verschuiven wanneer de pointer zich "toevallig" over
   * de kaart bevindt. Bij kaarten die een groot deel van een pagina beslaan kan dit vervelend zijn.
   */
  @Input()
  set focusVoorZoom(param: boolean) {
    this._focusVoorZoom = val.bool(param, this._focusVoorZoom);
  }

  /**
   * Laat rotatie van de kaart toe.
   */
  @Input()
  set rotatie(param: boolean) {
    this._rotatie = val.bool(param, this._rotatie);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.kaart.dispatch(prt.VoegStandaardInteractiesToeCmd(this._focusVoorZoom, this._rotatie, kaartLogOnlyWrapper));
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes["focusVoorZoom"] && !changes["focusVoorZoom"].firstChange) || (changes["rotatie"] && !changes["rotatie"].firstChange)) {
      // Een PasStandaardInteractiesAanCmd zou beter zijn
      this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
      this.kaart.dispatch(prt.VoegStandaardInteractiesToeCmd(this._focusVoorZoom, this._rotatie, kaartLogOnlyWrapper));
    }
  }
}
