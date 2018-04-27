import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { Component, OnInit, OnDestroy, Input } from "@angular/core";

@Component({
  selector: "awv-kaart-lagenkiezer-config",
  template: ""
})
export class LagenkiezerConfigComponent implements OnInit, OnDestroy {
  constructor(private readonly kaart: KaartClassicComponent) {}

  @Input() titels: string[] = [];

  ngOnInit() {}

  ngOnDestroy() {}
}
