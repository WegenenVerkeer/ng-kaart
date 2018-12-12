import { Component, Input, OnInit } from "@angular/core";

@Component({
  selector: "awv-kaart-element",
  templateUrl: "./kaart-element.component.html",
  styleUrls: ["./kaart-element.component.css"]
})
export class KaartElementComponent implements OnInit {
  @Input() size = 0;
  constructor() {}

  ngOnInit() {}
}
