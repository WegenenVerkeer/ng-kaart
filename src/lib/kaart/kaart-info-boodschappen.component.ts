import { Component, EventEmitter, NgZone, OnInit, Output } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { InfoBoodschappenMsg, infoBoodschapWrapper, KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { List } from "immutable";
import { InfoBoodschap } from "./kaart-with-info";
import { takeUntil } from "rxjs/operators";
import { ofType } from "../util/operators";
import { observeOnAngular } from "../util/observe-on-angular";

@Component({
  selector: "awv-kaart-info-boodschappen",
  templateUrl: "./kaart-info-boodschappen.component.html",
  styleUrls: ["./kaart-info-boodschappen.component.scss"]
})
export class KaartInfoBoodschappenComponent extends KaartChildComponentBase implements OnInit {
  @Output() infoBoodschappen$: EventEmitter<List<InfoBoodschap>> = new EventEmitter();

  constructor(zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.InfoBoodschapSubscription(infoBoodschapWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.internalMessage$
      .pipe(
        ofType<InfoBoodschappenMsg>("InfoBoodschappen"), //
        observeOnAngular(this.zone),
        takeUntil(this.destroying$) // autounsubscribe bij destroy component
      )
      .subscribe(msg => {
        this.infoBoodschappen$.emit(msg.infoBoodschappen);
      });
  }
}
