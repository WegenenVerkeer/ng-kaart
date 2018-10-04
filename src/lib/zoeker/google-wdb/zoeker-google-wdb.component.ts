import { Component, Inject, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Http } from "@angular/http";

import { KaartChildComponentBase } from "../../kaart/kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { KaartComponent } from "../../kaart/kaart.component";
import { ZOEKER_CFG, ZoekerConfigData } from "../config/zoeker-config";
import { Zoeker } from "../zoeker";
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE } from "../zoeker-representatie.service";

import { ZoekerGoogleWdbService } from "./zoeker-google-wdb.service";

@Component({
  selector: "awv-google-wdb-locatie-zoeker",
  template: "<ng-content></ng-content>"
})
export class ZoekerGoogleWdbComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private readonly zoeker: Zoeker;

  constructor(
    parent: KaartComponent,
    zone: NgZone,
    http: Http,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    super(parent, zone);
    this.zoeker = new ZoekerGoogleWdbService(3, 3, http, zoekerConfigData, zoekerRepresentatie);
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.dispatch({ type: "VoegZoekerToe", zoeker: this.zoeker, wrapper: kaartLogOnlyWrapper });
  }

  ngOnDestroy(): void {
    this.dispatch({ type: "VerwijderZoeker", zoeker: this.zoeker.naam(), wrapper: kaartLogOnlyWrapper });

    super.ngOnDestroy();
  }
}
