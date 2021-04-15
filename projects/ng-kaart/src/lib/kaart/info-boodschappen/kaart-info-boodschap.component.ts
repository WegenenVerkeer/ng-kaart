import {
  animate,
  state,
  style,
  transition,
  trigger,
} from "@angular/animations";
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  NgZone,
  OnInit,
} from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import scrollIntoView from "scroll-into-view-if-needed";

import { forEach } from "../../util";
import { KaartChildDirective } from "../kaart-child.directive";
import { SluitInfoBoodschapCmd } from "../kaart-protocol-commands";
import { foldInfoBoodschap, InfoBoodschap } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

@Component({
  selector: "awv-kaart-info-boodschap",
  templateUrl: "./kaart-info-boodschap.component.html",
  styleUrls: ["./kaart-info-boodschap.component.scss"],
  animations: [
    trigger("fadeIn", [
      state("visible", style({ opacity: 1 })),
      transition(":enter", [style({ opacity: 0 }), animate(200)]),
      transition(":leave", animate(0, style({ opacity: 0 }))),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KaartInfoBoodschapComponent
  extends KaartChildDirective
  implements OnInit {
  private infoBoodschap: InfoBoodschap;
  titel: string;
  kind: string;
  icon: string;

  @Input()
  set boodschap(bsch: InfoBoodschap) {
    this.infoBoodschap = bsch;
    this.titel = bsch.titel;
    this.kind = bsch.type;
    this.icon = foldInfoBoodschap(this.boodschap)(
      (alert) =>
        pipe(
          alert.iconName,
          option.getOrElse(() => "priority_high")
        ), //
      () => "description",
      () => "location_on",
      () => "straighten"
    );
  }
  get boodschap(): InfoBoodschap {
    return this.infoBoodschap;
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  ngOnInit() {
    super.ngOnInit();
    this.scrollIntoView(); // zorg dat de boodschap altijd in view komt
  }

  scrollIntoView() {
    setTimeout(
      () =>
        forEach(
          option.fromNullable(
            document.getElementById("kaart-info-boodschap-" + this.boodschap.id)
          ),
          (el) =>
            scrollIntoView(el, {
              behavior: "smooth",
              scrollMode: "if-needed",
            })
        ),
      200
    );
  }

  sluit(): void {
    this.dispatch(
      SluitInfoBoodschapCmd(
        this.boodschap.id,
        this.boodschap.sluit === "VANZELF",
        this.boodschap.verbergMsgGen
      )
    );
  }

  isSluitbaar(): boolean {
    return (
      this.boodschap.sluit === "DOOR_APPLICATIE" ||
      this.boodschap.sluit === "VANZELF"
    );
  }
}
