import { Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { VoegVolledigschermToe, VerwijderVolledigscherm } from "./kaart-protocol-events";

@Component({
  selector: "awv-kaart-knop-volledig-scherm",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-knop-volledig-scherm.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopVolledigSchermComponent implements OnInit, OnDestroy {
  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatch(new VoegVolledigschermToe());
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(new VerwijderVolledigscherm());
  }
}
