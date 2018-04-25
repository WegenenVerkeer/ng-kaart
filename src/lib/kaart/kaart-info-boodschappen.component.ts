import { Component, EventEmitter, NgZone, OnInit, Output } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { InfoBoodschappenMsg, infoBoodschappenMsgGen, KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { InfoBoodschap, KaartWithInfo } from "./kaart-with-info";
import { ofType } from "../util/operators";
import { observeOnAngular } from "../util/observe-on-angular";
import { Observable } from "rxjs/Observable";
import { KaartComponent } from "./kaart.component";
import { List } from "immutable";
import { animate, state, style, transition, trigger } from "@angular/animations";

@Component({
  selector: "awv-kaart-info-boodschappen",
  templateUrl: "./kaart-info-boodschappen.component.html",
  styleUrls: ["./kaart-info-boodschappen.component.scss"],
  animations: [
    trigger("fadeIn", [
      state("visible", style({ opacity: 1 })),
      transition(":enter", [style({ opacity: 0 }), animate(150)]),
      transition(":leave", animate(150, style({ opacity: 0 })))
    ])
  ]
})
export class KaartInfoBoodschappenComponent extends KaartChildComponentBase implements OnInit {
  @Output() infoBoodschappen$: EventEmitter<List<InfoBoodschap>> = new EventEmitter();

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.InfoBoodschappenSubscription(infoBoodschappenMsgGen)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    const kaartObs: Observable<KaartWithInfo> = this.kaartComponent.kaartWithInfo$;
    this.bindToLifeCycle(kaartObs);

    this.internalMessage$
      .pipe(
        ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
        observeOnAngular(this.zone)
      )
      .subscribe(msg => {
        this.infoBoodschappen$.emit(msg.infoBoodschappen.toList());
      });
  }
}
