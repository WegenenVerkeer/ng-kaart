import { HttpClient } from "@angular/common/http";
import { Component, Inject, NgZone, OnDestroy, OnInit } from "@angular/core";

import { KaartChildComponentBase } from "../../kaart/kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { KaartComponent } from "../../kaart/kaart.component";
import { AbstractRepresentatieService, ZOEKER_REPRESENTATIE } from "../../zoeker/zoeker-representatie.service";
import { ZOEKER_CFG, ZoekerConfigData } from "../config/zoeker-config";

import { ZoekerPerceelService } from "./zoeker-perceel.service";

@Component({
  selector: "awv-perceel-zoeker",
  template: "<ng-content></ng-content>"
})
export class ZoekerPerceelComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private readonly zoeker: ZoekerPerceelService;

  constructor(
    parent: KaartComponent,
    zone: NgZone,
    http: HttpClient,
    @Inject(ZOEKER_CFG) zoekerConfigData: ZoekerConfigData,
    @Inject(ZOEKER_REPRESENTATIE) private zoekerRepresentatie: AbstractRepresentatieService
  ) {
    super(parent, zone);
    this.zoeker = new ZoekerPerceelService(1, 1, http, zoekerConfigData, zoekerRepresentatie);
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
