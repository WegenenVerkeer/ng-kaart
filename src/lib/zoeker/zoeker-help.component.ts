import { Component } from "@angular/core";
import { MapIcons } from "./mapicons/mapicons";

@Component({
  selector: "awv-zoeker-help",
  templateUrl: "./zoeker-help.component.html",
  styleUrls: ["./zoeker-help.component.scss"]
})
export class ZoekerHelpComponent {
  baseimage(partialMatch: boolean) {
    return MapIcons.get("./" + (partialMatch ? "partial/" : "") + "number_" + 1 + ".png");
  }
}
