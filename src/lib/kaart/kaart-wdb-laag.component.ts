import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";
import { KaartLaagComponent } from "./kaart-laag.component";
import { KaartConfig } from "./kaart.config";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";

@Component({
  selector: "awv-kaart-wdb-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWdbLaagComponent extends KaartWmsLaagComponent implements OnInit, OnDestroy {
  constructor(kaart: KaartComponent, kaartConfig: KaartConfig, zone: NgZone) {
    super(kaart, kaartConfig, zone);
  }

  ngOnInit(): void {
    this.urls = this.config.wdb.urls;
    super.ngOnInit();
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
