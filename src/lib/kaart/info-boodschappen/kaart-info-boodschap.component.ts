import { animate, state, style, transition, trigger } from "@angular/animations";
import { Component, Input, NgZone, OnInit } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import scrollIntoView from "scroll-into-view-if-needed";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { SluitInfoBoodschapCmd } from "../kaart-protocol-commands";
import { InfoBoodschap } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

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
export class KaartInfoBoodschapComponent extends KaartChildComponentBase implements OnInit {
  @Input() boodschap: InfoBoodschap;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  ngOnInit() {
    super.ngOnInit();
    this.scrollIntoView(); // zorg dat de boodschap altijd in view komt
  }

  scrollIntoView() {
    setTimeout(
      () =>
        fromNullable(document.getElementById("kaart-info-boodschap-" + this.boodschap.id)).map(el =>
          scrollIntoView(el, {
            behavior: "smooth",
            scrollMode: "if-needed"
          })
        ),
      200
    );
  }

  sluit(): void {
    this.dispatch(SluitInfoBoodschapCmd(this.boodschap.id, this.boodschap.sluit === "VANZELF", this.boodschap.verbergMsgGen));
  }

  isSluitbaar(): boolean {
    return this.boodschap.sluit === "DOOR_APPLICATIE" || this.boodschap.sluit === "VANZELF";
  }
}
