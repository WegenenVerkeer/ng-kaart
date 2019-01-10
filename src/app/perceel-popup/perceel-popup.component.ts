import { Component, OnChanges } from "@angular/core";
import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";

@Component({
  selector: "awv-pat-perceel-popup",
  templateUrl: "./perceel-popup.component.html",
  styleUrls: ["./perceel-popup.component.scss"]
})
export class PerceelPopupComponent implements OnChanges {
  readonly offset = 10;

  text: string;
  display = "none";

  feature: Option<ol.Feature>;
  top: any;
  left: any;

  constructor() {}

  ngOnChanges() {}

  update(feature: Option<ol.Feature>) {
    this.feature = feature;
    this.toggleVisibility(this.feature.isSome());
    if (this.feature.isNone()) {
      this.text = "";
    } else {
      this.text = this.feature.toNullable().get("id");
    }
  }

  private toggleVisibility(onOff) {
    this.display = onOff ? "block" : "none";
  }

  move(evt: MouseEvent) {
    if (evt.srcElement.className !== "perceel-popup") {
      this.left = evt.offsetX + this.offset;
      this.top = evt.offsetY;
    }
  }
}
