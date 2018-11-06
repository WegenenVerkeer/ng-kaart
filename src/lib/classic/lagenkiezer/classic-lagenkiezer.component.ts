import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { Predicate } from "fp-ts/lib/function";

import { VerwijderUiElement, VoegUiElementToe, ZetUiElementOpties } from "../../kaart/kaart-protocol-commands";
import { DefaultOpties, LagenUiOpties, LagenUiSelector } from "../../lagenkiezer/lagenkiezer.component";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-lagenkiezer",
  template: ""
})
export class ClassicLagenkiezerComponent implements OnInit, OnDestroy, OnChanges {
  constructor(private readonly kaart: KaartClassicComponent) {}

  @Input()
  titels: string[] = []; // TODO nog te implementeren om te beperken tot deze

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
    this.kaart.dispatch(VoegUiElementToe(LagenUiSelector));
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  ngOnDestroy() {
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
