import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartConfig } from "./kaart.config";

@Component({
  selector: "awv-kaart-ortho-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartOrthoLaagComponent extends KaartWmsLaagComponent implements OnInit, OnDestroy {
  constructor(kaart: KaartComponent, config: KaartConfig, zone: NgZone) {
    super(kaart, config, zone);
  }

  ngOnInit(): void {
    this.laagNaam = "Ortho";
    this.urls = this.kaart.config.orthofotomozaiek.urls;
    super.ngOnInit();
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
