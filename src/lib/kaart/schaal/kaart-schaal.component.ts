import { AfterViewInit, Component, ElementRef, NgZone, ViewChild } from "@angular/core";
import * as option from "fp-ts/lib/Option";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export const SchaalUiSelector = "Schaal";

@Component({
  selector: "awv-schaal",
  templateUrl: "./kaart-schaal.html",
  styleUrls: ["./kaart-schaal.scss"]
})
export class KaartSchaalComponent extends KaartChildComponentBase implements AfterViewInit {
  @ViewChild("schaal") schaalElement: ElementRef;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  ngAfterViewInit(): void {
    this.dispatch(prt.VoegSchaalToeCmd(option.fromNullable(this.schaalElement.nativeElement), kaartLogOnlyWrapper));
  }
}
