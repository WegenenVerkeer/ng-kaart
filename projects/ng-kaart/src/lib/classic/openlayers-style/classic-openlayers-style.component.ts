import { Component, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "awv-ol-style",
  template: "<ng-content></ng-content>",
  styleUrls: ["../../../../../../node_modules/openlayers/css/ol.css", "./classic-openlayers-style.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartOpenLayersStyleComponent {}
