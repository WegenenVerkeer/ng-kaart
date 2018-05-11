import { Component, Input, NgZone } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { KaartComponent } from "./kaart.component";
import { InfoBoodschap } from "./kaart-with-info-model";
import { animate, state, style, transition, trigger } from "@angular/animations";
import { SluitInfoBoodschapCmd } from "./kaart-protocol-commands";

@Component({
  selector: "awv-kaart-info-boodschap",
  templateUrl: "./kaart-info-boodschap.component.html",
  styleUrls: ["./kaart-info-boodschap.component.scss"],
  animations: [
    trigger("fadeIn", [
      state("visible", style({ opacity: 1 })),
      transition(":enter", [style({ opacity: 0 }), animate(200)]),
      transition(":leave", animate(0, style({ opacity: 0 })))
    ])
  ]
})
export class KaartInfoBoodschapComponent extends KaartChildComponentBase {
  @Input() boodschap: InfoBoodschap;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  sluit(): void {
    this.dispatch(SluitInfoBoodschapCmd(this.boodschap.id, this.boodschap.verbergMsgGen));
  }
}
