import { Component, Injector, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { ClassicBaseComponent } from "../classic-base.component";

/**
 * Deze component zorgt voor een uitklapbare selector van achtergrondlagen. Welke lagen er in de selector staan hangt af
 * van de lagen die gedefinieerd zijn in de <code>&lt;awv-kaart-classic-tag&gt;</code>. De achtergrondselector gebruikt
 * standaard alle lagen van het type <code>&lt;awv-kaart-tilecache-laag&gt;</code>,
 * <code>&lt;awv-kaart-wmts-laag&gt;</code>, <code>&lt;awv-kaart-ortho-laag&gt;</code> en
 * <code>&lt;awv-kaart-blanco-laag&gt;</code>. Deze twee laatste zijn trouwens specifiek bedoeld voor de achtergrondlagenkiezer.
 *
 * Door de tag <code>groep</code> te zetten op ofwel <code>'Voorgrond.Laag'</code> of <code>'Achtergrond'</code>,
 * wordt een laag respectievelijk niet of wel bij de selecteerbare achtergronden opgenomen. Het is doorgaans geen goed
 * idee om een volledig dekkende laag in de voorgrond te gebruiken als de achtergrondselectie aanwezig is.
 */
@Component({
  selector: "awv-kaart-knop-achtergrondlaag-kiezer",
  template: "",
  encapsulation: ViewEncapsulation.None
})
export class ClassicAchtergrondSelectorComponent extends ClassicBaseComponent implements OnInit, OnDestroy {
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch(prt.ToonAchtergrondKeuzeCmd(kaartLogOnlyWrapper));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerbergAchtergrondKeuzeCmd(kaartLogOnlyWrapper));
    super.ngOnDestroy();
  }
}
