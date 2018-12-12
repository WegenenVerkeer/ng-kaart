import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "awv-webelt",
  templateUrl: "./webelt.component.html",
  styles: ["./webelt.component.scss"],
  encapsulation: ViewEncapsulation.Native
})
export class WebeltComponent {
  @Input() name = "friend";
  focus: string;
  focusSet = false;

  setFocus(value) {
    this.focus = value;
    this.focusSet = true;
  }
}
