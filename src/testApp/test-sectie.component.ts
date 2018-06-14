import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "awv-test-sectie",
  templateUrl: "./test-sectie.component.html",
  styleUrls: ["test-sectie.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class TestSectieComponent implements OnInit {
  @Input() sectieId = "";
  @Input() sectieTitel = "";
  @Input() subSectie = false;
  @Input() bevatSubSecties = false;
  @Input() sectieZichtbaar = false;

  ngOnInit(): void {
    // Nog niks.
  }

  toggleSectieZichtbaar() {
    this.sectieZichtbaar = !this.sectieZichtbaar;
  }
}
