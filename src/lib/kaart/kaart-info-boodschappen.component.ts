import { Component, EventEmitter, NgZone, OnInit, Output } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { InfoBoodschappenMsg, infoBoodschapWrapper, KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { List } from "immutable";
import { InfoBoodschap, KaartWithInfo } from "./kaart-with-info";
import { takeUntil } from "rxjs/operators";
import { ofType } from "../util/operators";
import { observeOnAngular } from "../util/observe-on-angular";
import { Observable } from "rxjs/Observable";
import { KaartComponent } from "./kaart.component";

@Component({
  selector: "awv-kaart-info-boodschappen",
  templateUrl: "./kaart-info-boodschappen.component.html",
  styleUrls: ["./kaart-info-boodschappen.component.scss"]
})
export class KaartInfoBoodschappenComponent extends KaartChildComponentBase implements OnInit {
  @Output() infoBoodschappen$: EventEmitter<List<InfoBoodschap>> = new EventEmitter();

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.InfoBoodschapSubscription(infoBoodschapWrapper)];
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
        this.infoBoodschappen$.emit(msg.infoBoodschappen);
      });
  }
}
