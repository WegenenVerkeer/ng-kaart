import { Component, OnInit, OnDestroy, NgZone } from "@angular/core";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

@Component({
  selector: "awv-lagenkiezer",
  templateUrl: "./lagenkiezer.component.html",
  styleUrls: ["lagenkiezer.component.scss"]
})
export class LagenkiezerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  constructor(parent: KaartComponent, ngZone: NgZone) {
    super(parent, ngZone);
  }

  ngOnInit() {
    super.ngOnInit();
    console.log("Init lagenkiezer");
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
