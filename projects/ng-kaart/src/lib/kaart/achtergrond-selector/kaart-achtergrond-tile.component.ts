import { Component, Input } from "@angular/core";

import { AchtergrondLaag, Laag, ToegevoegdeLaag } from "../kaart-elementen";

// Deze component wordt intern gebruikt in de achtergrond selector. Het is niet de bedoeling om deze zelf te gebruiken.

@Component({
  selector: "awv-kaart-achtergrond-tile",
  templateUrl: "./kaart-achtergrond-tile.component.html",
  styleUrls: ["./kaart-achtergrond-tile.component.scss"],
})
export class KaartAchtergrondTileComponent {
  @Input()
  laag: ToegevoegdeLaag;
  @Input()
  isCurrent: boolean;

  constructor() {}

  background() {
    const bron: Laag = this.laag.bron;
    return bron.hasOwnProperty("backgroundUrl")
      ? (bron as AchtergrondLaag).backgroundUrl
      : "";
  }
}
