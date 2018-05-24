import { Component, DoCheck, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";
import * as ol from "openlayers";

import { KaartClassicComponent } from "../classic/kaart-classic.component";
import { ClassicVectorLaagComponent } from "../classic/lagen/classic-vector-laag.component";

import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

@Component({
  selector: "awv-kaart-features-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartFeaturesLaagComponent extends ClassicVectorLaagComponent implements OnInit, OnDestroy, DoCheck {
  @Input() features = [] as ol.Feature[];

  // TODO combineren met 'selecteerbaar' van kaart-vector-laag
  @Output() featureGeselecteerd: EventEmitter<ol.Feature> = new EventEmitter<ol.Feature>();

  private vorigeFeatures: List<ol.Feature> = List();

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  ngOnInit(): void {
    super.ngOnInit(); // dit voegt een vectorlaag toe
    this.vorigeFeatures = List(this.features);
    this.dispatchVervangFeatures(this.vorigeFeatures);
  }

  ngOnDestroy(): void {
    this.dispatchVervangFeatures(List());
    super.ngOnDestroy(); // dit verwijdert de laag weer
  }

  ngDoCheck(): void {
    // deze check ipv ngOnChanges want wijziging aan features staat niet in SimpleChanges
    const features = List(this.features);
    if (!this.vorigeFeatures.equals(features)) {
      this.vorigeFeatures = features;
      this.dispatchVervangFeatures(features);
    }
  }

  private dispatchVervangFeatures(features: List<ol.Feature>) {
    this.dispatch(prt.VervangFeaturesCmd(this.titel, features, kaartLogOnlyWrapper));
  }
}
