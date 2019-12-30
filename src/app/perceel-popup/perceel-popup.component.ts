import { Component, OnChanges } from "@angular/core";
import { option } from "fp-ts";
import { Option } from "fp-ts/lib/Option";
import * as ol from "projects/ng-kaart/src/lib/util/openlayers-compat";

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
    this.text = this.feature.chain(f => option.fromNullable(f.get("id"))).getOrElse("");
  }

  private toggleVisibility(onOff) {
    this.display = onOff ? "block" : "none";
  }

  move(evt: MouseEvent) {
    if (evt.srcElement!["className"] !== "perceel-popup") {
      this.left = evt.offsetX + this.offset;
      this.top = evt.offsetY;
    }
  }
}
