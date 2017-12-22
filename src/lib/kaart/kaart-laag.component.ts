import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";

import * as ol from "openlayers";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartConfig } from "./kaart.config";

export abstract class KaartLaagComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;

  private layer: ol.layer.Layer;

  constructor(protected readonly kaart: KaartComponent, protected readonly config: KaartConfig, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    this.runAsapOutsideAngular(() => {
      this.layer = this.createLayer();
      if (!this.layer) {
        throw new Error("Geen laag gedefinieerd");
      }
      this.kaart.voegLaagToe(this.layer);
    });
  }

  ngOnDestroy(): void {
    this.runAsapOutsideAngular(() => {
      this.kaart.verwijderLaag(this.layer);
    });
  }

  public get srs(): string {
    return this.config.srs;
  }

  abstract createLayer(): ol.layer.Layer;
}
