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

  private _headerTitle = DefaultOpties.headerTitel;

  public get headerTitle(): string {
    return this._headerTitle;
  }
  public set headerTitle(value: string) {
    this._headerTitle = val.str(value, this._headerTitle);
  }

  @Input()
  headerTitel = DefaultOpties.headerTitel;
  @Input()
  initieelDichtgeklapt = DefaultOpties.initieelDichtgeklapt;
  @Input()
  toonLegende = DefaultOpties.toonLegende;
  @Input()
  verwijderbareLagen = DefaultOpties.verwijderbareLagen;
  @Input()
  verplaatsbareLagen = DefaultOpties.verplaatsbareLagen;
  @Input()
  stijlbareVectorlagen: Predicate<string> = DefaultOpties.stijlbareVectorlagen;

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
      headerTitel: this.headerTitel,
      initieelDichtgeklapt: this.initieelDichtgeklapt,
      toonLegende: this.toonLegende,
      verwijderbareLagen: this.verwijderbareLagen,
      verplaatsbareLagen: this.verplaatsbareLagen,
      stijlbareVectorlagen: this.stijlbareVectorlagen
    };
  }
}
