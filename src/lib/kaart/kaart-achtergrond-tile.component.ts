import { Component, Input } from "@angular/core";
import { isWmsLaag, WmsLaag, AchtergrondLaag } from "./kaart-elementen";

// Deze component wordt intern gebruikt in de achtergrond selector. Het is niet de bedoeling om deze zelf te gebruiken.

@Component({
  selector: "awv-kaart-achtergrond-tile",
  templateUrl: "./kaart-achtergrond-tile.component.html",
  styleUrls: ["./kaart-achtergrond-tile.component.scss"]
})
export class KaartAchtergrondTileComponent {
  @Input() laag: AchtergrondLaag;
  @Input() isCurrent: boolean;

  constructor() {}

  background() {
    return isWmsLaag(this.laag) ? wmsBackground(this.laag as WmsLaag) : transparentBackground();
  }
}

function wmsBackground(laag: WmsLaag) {
  // Dit is natuurlijk een hack, maar een openlayers kaart aanmaken per tile is nog problematischer
  return (
    laag.urls.get(0) + // mag wat veiliger
    "?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=false&LAYERS=" +
    laag.naam +
    "&TILED=true&SRS=EPSG%3A31370&WIDTH=256&HEIGHT=256&CRS=EPSG%3A31370&STYLES=&BBOX=104528%2C188839.75%2C105040%2C189351.75"
  );
}

function transparentBackground() {
  return "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
}
