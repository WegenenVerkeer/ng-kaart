import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { pipe } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";
import { merge } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";

import * as ke from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import { ofType } from "../../util";
import { urlWithParams } from "../../util/url";
import { classicMsgSubscriptionCmdOperator, KaartClassicComponent } from "../kaart-classic.component";
import { KaartClassicMsg, logOnlyWrapper, PrecacheProgressMsg } from "../messages";

import { ClassicLaagComponent } from "./classic-laag.component";

export interface PrecacheWMS {
  startZoom: number;
  eindZoom: number;
  wkt: string;
  startMetLegeCache: boolean;
}

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicWmsLaagComponent extends ClassicLaagComponent implements OnInit, AfterViewInit {
  @Input()
  laagNaam: string;
  @Input()
  urls: string[];
  @Input()
  tiled = true;
  @Input()
  type: string;
  @Input()
  versie?: string;
  @Input()
  format = "image/png";
  @Input()
  // tslint:disable-next-line:whitespace
  tileSize? = 256;
  @Input()
  opacity?: number;
  @Input()
  offline = false;

  @Input()
  set precache(input: PrecacheWMS) {
    if (input) {
      this.dispatch(prt.VulCacheVoorLaag(this.titel, input.startZoom, input.eindZoom, input.wkt, input.startMetLegeCache, logOnlyWrapper));
    }
  }

  @Output()
  precacheProgress: EventEmitter<number> = new EventEmitter<number>();

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(kaart, zone);
  }

  ngOnInit() {
    if (["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(this.gekozenLaagGroep()) < 0) {
      throw new Error("groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn");
    }
    super.ngOnInit();
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.TiledWmsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: List(this.urls),
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      backgroundUrl: this.backgroundUrl(List(this.urls), this.laagNaam),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      verwijderd: false
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(urls: List<string>, laagNaam: string): string {
    // TODO: rekening houden met echte config.
    return urlWithParams(urls.get(0), {
      layers: this.laagNaam,
      styles: "",
      service: "WMS",
      request: "GetMap",
      version: "1.3.0",
      transparant: false,
      tiled: true,
      width: 256,
      height: 256,
      format: this.format,
      srs: "EPSG:31370",
      crs: "EPSG:31370",
      bbox: "104528,188839.75,105040,189351.75"
    });
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    if (this.offline) {
      this.dispatch(prt.ActiveerCacheVoorLaag(this.titel, logOnlyWrapper));

      this.bindToLifeCycle(
        merge(
          this.kaart.kaartClassicSubMsg$.lift(
            classicMsgSubscriptionCmdOperator(
              this.kaart.dispatcher,
              prt.PrecacheProgressSubscription(
                pipe(
                  PrecacheProgressMsg,
                  KaartClassicMsg
                )
              )
            )
          ),
          this.kaart.kaartClassicSubMsg$.pipe(
            ofType<PrecacheProgressMsg>("PrecacheProgress"),
            map(m => (m.progress[this.titel] ? m.progress[this.titel] : 0)),
            distinctUntilChanged(),
            map(progress => this.precacheProgress.emit(progress))
          )
        )
      ).subscribe();
    }
  }
}
