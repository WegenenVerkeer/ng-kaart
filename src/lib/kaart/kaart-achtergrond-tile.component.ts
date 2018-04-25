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
    return this.laag.backgroundUrl;
  }
}
