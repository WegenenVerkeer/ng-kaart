import { Component, Injector, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { Predicate } from "fp-ts/lib/function";

import { VerwijderUiElement, VoegUiElementToe, ZetUiElementOpties } from "../../kaart/kaart-protocol-commands";
import { DefaultOpties, LagenUiOpties, LagenUiSelector } from "../../lagenkiezer/lagenkiezer.component";
import { ClassicBaseComponent } from "../classic-base.component";
import * as val from "../webcomponent-support/params";

/**
 * De lagenkiezer wordt getoond in het linkerpaneel en toont welke lagen er aanwezig zijn. Voor featurelagen wordt ook
 * een legende getoond. Verder kunnen lagen af en aangezet of verwijderd worden en van volgorde veranderd.
 *
 */
@Component({
  selector: "awv-kaart-lagenkiezer",
  template: ""
})
export class ClassicLagenkiezerComponent extends ClassicBaseComponent implements OnInit, OnDestroy, OnChanges {
  constructor(injector: Injector) {
    super(injector);
  }

  @Input()
  stijlbareVectorlagen: Predicate<string> = DefaultOpties.stijlbareVectorlagen;

  _headerTitel = DefaultOpties.headerTitel;
  _initieelDichtgeklapt = DefaultOpties.initieelDichtgeklapt;
  _toonLegende = DefaultOpties.toonLegende;
  _verwijderbareLagen = DefaultOpties.verwijderbareLagen;
  _verplaatsbareLagen = DefaultOpties.verplaatsbareLagen;

  @Input()
  public set headerTitel(value: string) {
    this._headerTitel = val.str(value, this._headerTitel);
  }

  @Input()
  public set initieelDichtgeklapt(param: boolean) {
    this._initieelDichtgeklapt = val.bool(param, this._initieelDichtgeklapt);
  }

  @Input()
  public set toonLegende(param: boolean) {
    this._toonLegende = val.bool(param, this._toonLegende);
  }

  @Input()
  public set verwijderbareLagen(param: boolean) {
    this._verwijderbareLagen = val.bool(param, this._verwijderbareLagen);
  }

  @Input()
  public set verplaatsbareLagen(param: boolean) {
    this._verplaatsbareLagen = val.bool(param, this._verplaatsbareLagen);
  }

  ngOnInit() {
    super.ngOnInit();
    this.kaart.dispatch(VoegUiElementToe(LagenUiSelector));
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.kaart.dispatch(VerwijderUiElement(LagenUiSelector));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  private opties(): LagenUiOpties {
    return {
      headerTitel: this._headerTitel,
      initieelDichtgeklapt: this._initieelDichtgeklapt,
      toonLegende: this._toonLegende,
      verwijderbareLagen: this._verwijderbareLagen,
      verplaatsbareLagen: this._verplaatsbareLagen,
      stijlbareVectorlagen: this.stijlbareVectorlagen
    };
  }
}
