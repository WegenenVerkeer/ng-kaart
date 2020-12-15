import { Directive, Input, NgZone } from "@angular/core";

import { KaartChildDirective } from "../kaart-child.directive";
import { InfoBoodschapBase } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";
import { SluitInfoBoodschapCmd } from "../kaart-protocol-commands";

@Directive()
export class KaartInfoBoodschapBaseDirective<
  T extends InfoBoodschapBase
> extends KaartChildDirective {
  private infoBoodschap: T;

  @Input()
  isSluitbaar: boolean;

  @Input()
  set boodschap(bsch: T) {
    this.infoBoodschap = bsch;
  }

  get boodschap(): T {
    return this.infoBoodschap;
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  sluit(): void {
    this.dispatch(
      SluitInfoBoodschapCmd(
        this.infoBoodschap.id,
        this.infoBoodschap.sluit === "VANZELF",
        this.infoBoodschap.verbergMsgGen
      )
    );
  }
}
