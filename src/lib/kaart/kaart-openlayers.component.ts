import { Component, ElementRef, Inject, Input, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "awv-ol-style",
  template: "<ng-content></ng-content>",
  styleUrls: ["../../../node_modules/openlayers/css/ol.css", "./kaart-openlayers.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartOpenLayersStyleComponent {}
