import { animate, style, transition, trigger } from "@angular/animations";
import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "awv-test-sectie",
  templateUrl: "./test-sectie.component.html",
  styleUrls: ["test-sectie.component.scss"],
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 1, "max-height": "1000px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "1000px" }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None
})
export class TestSectieComponent implements OnInit {
  @Input()
  sectieId = "";
  @Input()
  sectieTitel = "";
  @Input()
  subSectie = false;
  @Input()
  bevatSubSecties = false;
  @Input()
  sectieZichtbaar = false;

  ngOnInit(): void {
    // Nog niks.
  }

  toggleSectieZichtbaar() {
    this.sectieZichtbaar = !this.sectieZichtbaar;
  }
}
