import {
  Component,
  ContentChildren,
  Input,
  QueryList,
  ViewEncapsulation,
} from "@angular/core";

@Component({
  selector: "awv-test-sectie",
  templateUrl: "./test-sectie.component.html",
  styleUrls: ["test-sectie.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class TestSectieComponent {
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

  @ContentChildren(TestSectieComponent)
  children: QueryList<TestSectieComponent>;

  toggleSectieZichtbaar() {
    this.sectieZichtbaar = !this.sectieZichtbaar;
  }

  zetSectieZichtbaarheid(zichtbaar: boolean) {
    this.sectieZichtbaar = zichtbaar;
  }

  maakSectieZichtbaar(id: string) {
    const sectie = this.children.find((child) => child.sectieId === id);
    if (sectie) {
      this.children.map((child) => child.zetSectieZichtbaarheid(false));
      sectie.zetSectieZichtbaarheid(true);
    }
  }
}
