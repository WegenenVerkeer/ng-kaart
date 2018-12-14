import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "awv-kaart-element",
  templateUrl: "./kaart-element.component.html",
  styleUrls: ["./kaart-element.component.css"]
})
export class KaartElementComponent implements OnInit {
  @Input() zoom = 2;
  constructor() {}

  ngOnInit() {}
}
