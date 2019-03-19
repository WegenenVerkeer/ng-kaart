import { HttpClient } from "@angular/common/http";
import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { Function1, Function2, Function4, pipe } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { merge } from "rxjs";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, tap } from "rxjs/operators";

import { LaagLocationInfo, TextLaagLocationInfo, VeldinfoLaagLocationInfo, Veldwaarde } from "../../kaart";
import * as ke from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import { VoegLaagLocatieInformatieServiceToe } from "../../kaart/kaart-protocol";
import { ofType } from "../../util";
import { fromNullableFunc } from "../../util/function";
import { urlWithParams } from "../../util/url";
import { classicMsgSubscriptionCmdOperator, KaartClassicComponent } from "../kaart-classic.component";
import { KaartClassicMsg, LaatsteCacheRefreshMsg, logOnlyWrapper, PrecacheProgressMsg } from "../messages";

import { ClassicLaagComponent } from "./classic-laag.component";

const noQueryUrl = () => undefined;

const wmsFeatureInfo: Function2<HttpClient, Function1<ol.Coordinate, Option<string>>, Function1<ol.Coordinate, rx.Observable<string>>> = (
  httpClient,
  queryUrlFn
) => location => {
  const maybeUrl = queryUrlFn(location);
  return maybeUrl.fold(rx.empty(), url => httpClient.get(url, { responseType: "text" }));
};

const textWmsFeatureInfo: Function2<
  HttpClient,
  Function1<ol.Coordinate, Option<string>>,
  Function1<ol.Coordinate, rx.Observable<LaagLocationInfo>>
> = (httpClient, queryUrlFn) => location => wmsFeatureInfo(httpClient, queryUrlFn)(location).pipe(map(TextLaagLocationInfo));

const veldWmsFeatureInfo: Function4<
  HttpClient,
  Function1<ol.Coordinate, Option<string>>,
  Function1<string, Veldwaarde[]>,
  ke.VeldInfo[],
  Function1<ol.Coordinate, rx.Observable<LaagLocationInfo>>
> = (httpClient, queryUrlFn, parser, veldinfos) => location =>
  wmsFeatureInfo(httpClient, queryUrlFn)(location).pipe(map(text => VeldinfoLaagLocationInfo(parser(text), veldinfos)));

export interface PrecacheWMS {
  readonly startZoom: number;
  readonly eindZoom: number;
  readonly wkt: string;
  readonly startMetLegeCache: boolean;
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
  versie?: string;
  @Input()
  format = "image/png";
  @Input()
  // tslint:disable-next-line:whitespace
  tileSize? = 256;
  @Input()
  opacity?: number;
  @Input()
  cacheActief = false;
  // metadata van de velden zoals die geparsed worden door textParser
  @Input()
  veldinfos?: ke.VeldInfo[] = undefined;
  // Een functie die de output van een WMS featureInfo of een WFS GetFeature request omzet naar een lijst van key-value paren.
  // De keys moeten een subset zijn van de titels van de veldinfos
  @Input()
  textParser?: Function1<string, Veldwaarde[]> = undefined;
  // Een functie die coördinaten omzet naar een WMS GetFeatureInfo of WFS GetFeature URL
  // `undefined` als waarde van de Input wil zeggen dat de output als een ruwe string weergegeven wordt
  // `undefined` als resultaat van de functie wil zeggen dat er geen request gemaakt wordt voor de gegeven locatie.
  @Input()
  queryUrlFn?: Function1<ol.Coordinate, string | undefined> = noQueryUrl;

  @Input()
  set precache(input: PrecacheWMS) {
    if (input) {
      this.dispatch(
        prt.VulCacheVoorWMSLaag(this.titel, input.startZoom, input.eindZoom, input.wkt, input.startMetLegeCache, logOnlyWrapper)
      );
    }
  }

  @Output()
  precacheProgress: EventEmitter<number> = new EventEmitter<number>();

  @Output()
  laatsteCacheRefresh: EventEmitter<Date> = new EventEmitter<Date>();

  constructor(kaart: KaartClassicComponent, zone: NgZone, private readonly http: HttpClient) {
    super(kaart, zone);
  }

  ngOnInit() {
    if (["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(this.gekozenLaagGroep()) < 0) {
      throw new Error("groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn");
    }
    super.ngOnInit();
  }

  protected voegLaagToe() {
    super.voegLaagToe();
    if (this.queryUrlFn) {
      if (!this.veldinfos) {
        this.dispatch(
          VoegLaagLocatieInformatieServiceToe(
            this.titel,
            { infoByLocation$: textWmsFeatureInfo(this.http, fromNullableFunc(this.queryUrlFn)) },
            logOnlyWrapper
          )
        );
      } else if (this.textParser && this.veldinfos) {
        this.dispatch(
          VoegLaagLocatieInformatieServiceToe(
            this.titel,
            { infoByLocation$: veldWmsFeatureInfo(this.http, fromNullableFunc(this.queryUrlFn), this.textParser, this.veldinfos) },
            logOnlyWrapper
          )
        );
      }
    }
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.TiledWmsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: this.urls,
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      backgroundUrl: this.backgroundUrl(this.urls, this.laagNaam),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      verwijderd: false
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(urls: Array<string>, laagNaam: string): string {
    // TODO: rekening houden met echte config.
    return urlWithParams(urls[0], {
      layers: laagNaam,
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

    if (this.cacheActief) {
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
              ),
              prt.LaatsteCacheRefreshSubscription(
                pipe(
                  LaatsteCacheRefreshMsg,
                  KaartClassicMsg
                )
              )
            )
          ),
          this.kaart.kaartClassicSubMsg$.pipe(
            ofType<PrecacheProgressMsg>("PrecacheProgress"),
            map(m => (m.progress[this.titel] ? m.progress[this.titel] : 0)),
            distinctUntilChanged(),
            tap(progress => this.precacheProgress.emit(progress))
          ),
          this.kaart.kaartClassicSubMsg$.pipe(
            ofType<LaatsteCacheRefreshMsg>("LaatsteCacheRefresh"),
            filter(m => fromNullable(m.laatsteCacheRefresh[this.titel]).isSome()),
            map(m => m.laatsteCacheRefresh[this.titel]),
            distinctUntilChanged(),
            tap(laatsteCacheRefresh => this.laatsteCacheRefresh.emit(laatsteCacheRefresh))
          )
        )
      ).subscribe();
    }
  }
}
