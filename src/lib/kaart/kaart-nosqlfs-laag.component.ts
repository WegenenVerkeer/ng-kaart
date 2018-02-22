import { Component, Input, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";
import { NosqlFsSource } from "../source/nosql-fs-source";

const stdStijl = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "gray"
  }),
  stroke: new ol.style.Stroke({
    color: "darkslateblue ",
    width: 4
  }),
  image: new ol.style.Circle({
    fill: new ol.style.Fill({
      color: "maroon"
    }),
    stroke: new ol.style.Stroke({
      color: "gray",
      width: 1.25
    }),
    radius: 5
  })
});

@Component({
  selector: "awv-kaart-nosqlfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartNosqlfsLaagComponent extends KaartLaagComponent {
  @Input() url = "/geolatte-nosqlfs";
  @Input() database: string;
  @Input() collection: string;
  @Input() style: ol.style.Style = stdStijl;
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minZoom = 7;
  @Input() maxZoom = 15;
  @Input() view = "default";
  @Input() filter: string;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: new NosqlFsSource(this.database, this.collection, this.url, this.view, this.filter),
      style: this.style,
      selecteerbaar: this.selecteerbaar,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }
}
