import { Component, Input } from "@angular/core";
import { WmsLaag } from "./kaart-elementen";

// Deze component wordt intern gebruikt in de achtergrond selector. Het is niet de bedoeling om deze zelf te gebruiken.

@Component({
  selector: "awv-kaart-achtergrond-tile",
  templateUrl: "./kaart-achtergrond-tile.component.html",
  styleUrls: ["./kaart-achtergrond-tile.component.scss"]
})
export class KaartAchtergrondTileComponent {
  @Input() laag: WmsLaag;
  @Input() isCurrent: boolean;

  constructor() {}

  background() {
    // Dit is natuurlijk een hack, maar een openlayers kaart aanmaken per tile is nog problematischer
    return (
      this.laag.urls.get(0) + // mag wat veiliger
      "?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=false&LAYERS=" +
      this.laag.naam +
      "&TILED=true&SRS=EPSG%3A31370&WIDTH=256&HEIGHT=256&CRS=EPSG%3A31370&STYLES=&BBOX=104528%2C188839.75%2C105040%2C189351.75"
    );
  }
}
