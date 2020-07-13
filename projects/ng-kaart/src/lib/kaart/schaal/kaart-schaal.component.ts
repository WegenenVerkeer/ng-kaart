import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from "@angular/core";
import { option } from "fp-ts";

import { KaartChildDirective } from "../kaart-child.directive";
import { kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export const SchaalUiSelector = "Schaal";

@Component({
  selector: "awv-schaal",
  templateUrl: "./kaart-schaal.component.html",
  styleUrls: ["./kaart-schaal.component.scss"]
})
export class KaartSchaalComponent extends KaartChildDirective implements AfterViewInit, OnDestroy {
  @ViewChild("schaal")
  schaalElement: ElementRef;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  ngAfterViewInit(): void {
    super.ngAfterViewInit();
    this.dispatch(prt.VoegSchaalToeCmd(option.fromNullable(this.schaalElement.nativeElement), kaartLogOnlyWrapper));
  }

  ngOnDestroy(): void {
    this.dispatch(prt.VerwijderSchaalCmd(kaartLogOnlyWrapper));
    super.ngOnDestroy();
  }
}
