import { HttpClient } from "@angular/common/http";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  Injector,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
} from "@angular/core";
import { array, eq, map as fpMap, option } from "fp-ts";
import {
  Curried2,
  Function1,
  Function2,
  Function4,
  pipe,
} from "fp-ts/lib/function";
import { merge } from "rxjs";
import * as rx from "rxjs";
import { distinctUntilChanged, filter, map, tap } from "rxjs/operators";

import { Epsg } from "../../coordinaten/coordinaten.service";
import {
  BevragenErrorReason,
  KaartLocaties,
  LaagLocationInfo,
  LaagLocationInfoResult,
  progressFailure,
  TextLaagLocationInfo,
  VeldinfoLaagLocationInfo,
  Veldwaarde,
} from "../../kaart/kaart-bevragen/laaginfo.model";
import * as ke from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import { VoegLaagLocatieInformatieServiceToe } from "../../kaart/kaart-protocol";
import { collectOption, forEach, ofType } from "../../util";
import * as ol from "../../util/openlayers-compat";
import * as progress from "../../util/progress";
import { urlWithParams } from "../../util/url";
import { classicMsgSubscriptionCmdOperator } from "../kaart-classic.component";
import {
  KaartClassicMsg,
  LaatsteCacheRefreshMsg,
  logOnlyWrapper,
  PrecacheProgressMsg,
  PublishedKaartLocatiesMsg,
} from "../messages";
import * as val from "../webcomponent-support/params";

import { ClassicLaagDirective } from "./classic-laag.directive";

const wmsFeatureInfo: Function2<
  HttpClient,
  Function1<ol.Coordinate, string>,
  Function1<ol.Coordinate, rx.Observable<string>>
> = (httpClient, queryUrlFn) => (location) =>
  httpClient.get(queryUrlFn(location), { responseType: "text" });

const textWmsFeatureInfo: Function2<
  HttpClient,
  Function1<ol.Coordinate, string>,
  Function1<ol.Coordinate, rx.Observable<LaagLocationInfo>>
> = (httpClient, queryUrlFn) => (location) =>
  wmsFeatureInfo(
    httpClient,
    queryUrlFn
  )(location).pipe(map(TextLaagLocationInfo));

const veldWmsFeatureInfo: Function4<
  HttpClient,
  Function1<ol.Coordinate, string>,
  Function1<string, Veldwaarde[]>,
  ke.VeldInfo[],
  Function1<ol.Coordinate, rx.Observable<LaagLocationInfo>>
> = (httpClient, queryUrlFn, parser, veldinfos) => (location) =>
  wmsFeatureInfo(
    httpClient,
    queryUrlFn
  )(location).pipe(
    map((text) => VeldinfoLaagLocationInfo(parser(text), veldinfos))
  );

export interface PrecacheWMS {
  readonly startZoom: number;
  readonly eindZoom: number;
  readonly wkt: string;
  readonly startMetLegeCache: boolean;
}

export interface ClassicLaagKlikInfoEnStatus {
  readonly timestamp: number;
  readonly coordinaat: ol.Coordinate;
  readonly laagInfoStatus: progress.ProgressStatus;
  readonly laagInfo?: LaagLocationInfo;
  readonly laagInfoFailure?: BevragenErrorReason;
}

const flatten: Curried2<
  string,
  KaartLocaties,
  option.Option<ClassicLaagKlikInfoEnStatus>
> = (titel) => (kaartLocaties) => {
  const maybeLaagInfoResult: option.Option<progress.Progress<
    LaagLocationInfoResult
  >> = fpMap.lookup(eq.eqString)(titel, kaartLocaties.lagenLocatieInfo);
  return maybeLaagInfoResult.map((laagInfoResult) => ({
    timestamp: kaartLocaties.timestamp,
    coordinaat: kaartLocaties.coordinaat,
    laagInfoStatus: progress.toProgressStatus(laagInfoResult),
    laagInfo: progress
      .toOption(laagInfoResult)
      .chain(option.fromEither)
      .toUndefined(),
    laagInfoFailure: progressFailure(laagInfoResult),
  }));
};

const infoSetoid: eq.Eq<ClassicLaagKlikInfoEnStatus> = eq.getStructEq({
  timestamp: eq.eqNumber,
  coordinaat: array.getEq(eq.eqNumber),
  laagInfoStatus: progress.setoidProgressStatus,
});

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None,
})
export class ClassicWmsLaagComponent
  extends ClassicLaagDirective
  implements OnInit, AfterViewInit {
  // Een functie die de output van een WMS featureInfo of een WFS GetFeature request omzet naar een lijst van key-value paren.
  // De keys moeten een subset zijn van de titels van de veldinfos
  @Input()
  textParser?: Function1<string, Veldwaarde[]> = undefined;
  // Een functie die coördinaten omzet naar een WMS GetFeatureInfo of WFS GetFeature URL
  // `undefined` als waarde van de Input wil zeggen dat er geen query uitgevoerd wordt
  @Input()
  queryUrlFn?: Function1<ol.Coordinate, string> = undefined;

  @Input()
  set precache(input: PrecacheWMS | undefined) {
    if (input) {
      this.dispatch(
        prt.VulCacheVoorWMSLaag(
          this._titel,
          input.startZoom,
          input.eindZoom,
          input.wkt,
          input.startMetLegeCache,
          logOnlyWrapper
        )
      );
    }
  }

  @Output()
  precacheProgress: EventEmitter<number> = new EventEmitter<number>();

  @Output()
  laatsteCacheRefresh: EventEmitter<Date> = new EventEmitter<Date>();

  /**
   * Vuurt events wanneer er informatie voor deze laag is betreffende de locatie waar geklikt is.
   */
  @Output()
  laagLocaties: EventEmitter<ClassicLaagKlikInfoEnStatus> = new EventEmitter();

  _laagNaam: string;
  _versie: option.Option<string> = option.none;
  _format = "image/png";
  _urls: string[];
  _cqlFilter: option.Option<string> = option.none;
  _tiled: boolean;
  _tileSize = 256;
  _cacheActief = false;
  _veldInfos: option.Option<ke.VeldInfo[]> = option.none;
  _beschikbareProjecties: string[] = [Epsg.Lambert72];

  @Input()
  set laagNaam(param: string) {
    this._laagNaam = val.str(param, this._laagNaam);
  }

  @Input()
  set versie(param: string) {
    this._versie = val.optStr(param);
  }

  @Input()
  set format(param: string) {
    this._format = val.str(param, this._format);
  }

  @Input()
  set urls(param: string[]) {
    this._urls = val.stringArray(param, this._urls);
  }

  @Input()
  set tiled(param: boolean) {
    this._tiled = val.bool(param, this._tiled);
  }

  @Input()
  set tileSize(param: number) {
    this._tileSize = val.num(param, this._tileSize);
  }

  @Input()
  set cacheActief(param: boolean) {
    this._cacheActief = val.bool(param, this._cacheActief);
  }

  @Input()
  set cqlFilter(param: string) {
    this._cqlFilter = option.fromNullable(param);
  }

  // metadata van de velden zoals die geparsed worden door textParser
  // als er geen veldinfos opgegeven zijn, wordt hoogstens een textresultaat getoond bij kaart bevragen
  @Input()
  set veldinfos(param: ke.VeldInfo[]) {
    this._veldInfos = val.optVeldInfoArray(param);
  }

  @Input()
  public set beschikbareProjecties(param: string[]) {
    this._beschikbareProjecties = val.stringArray(
      param,
      this._beschikbareProjecties
    );
  }

  constructor(injector: Injector, private readonly http: HttpClient) {
    super(injector);
  }

  ngOnInit() {
    if (
      ["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(
        this.gekozenLaagGroep()
      ) < 0
    ) {
      throw new Error(
        "groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn"
      );
    }
    super.ngOnInit();
  }

  protected voegLaagToe() {
    super.voegLaagToe();
    forEach(option.fromNullable(this.queryUrlFn), (queryUrlFn) =>
      this.dispatch(
        this._veldInfos
          .chain((veldinfos) =>
            option.fromNullable(this.textParser).map((textParser) =>
              VoegLaagLocatieInformatieServiceToe(
                this._titel,
                {
                  infoByLocation$: veldWmsFeatureInfo(
                    this.http,
                    queryUrlFn,
                    textParser,
                    veldinfos
                  ),
                },
                logOnlyWrapper
              )
            )
          )
          .getOrElseL(() =>
            VoegLaagLocatieInformatieServiceToe(
              this._titel,
              { infoByLocation$: textWmsFeatureInfo(this.http, queryUrlFn) },
              logOnlyWrapper
            )
          )
      )
    );
  }

  createLayer(): ke.WmsLaag {
    if (this._tiled) {
      return {
        type: ke.TiledWmsType,
        titel: this._titel,
        naam: this._laagNaam,
        urls: this._urls,
        versie: this._versie,
        cqlFilter: this._cqlFilter,
        tileSize: option.fromNullable(this._tileSize),
        format: option.fromNullable(this._format),
        backgroundUrl: this.backgroundUrl(this._urls, this._laagNaam),
        minZoom: this._minZoom,
        maxZoom: this._maxZoom,
        verwijderd: false,
        beschikbareProjecties: this._beschikbareProjecties,
      };
    } else {
      return {
        type: ke.SingleTileWmsType,
        titel: this._titel,
        naam: this._laagNaam,
        urls: this._urls,
        versie: this._versie,
        cqlFilter: this._cqlFilter, // wordt niet gebruikt evenwel
        tileSize: option.none,
        format: option.fromNullable(this._format),
        backgroundUrl: this.backgroundUrl(this._urls, this._laagNaam),
        minZoom: this._minZoom,
        maxZoom: this._maxZoom,
        verwijderd: false,
        beschikbareProjecties: this._beschikbareProjecties,
      };
    }
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
      tiled: this._tiled,
      width: 256,
      height: 256,
      format: this._format,
      srs: "EPSG:31370",
      crs: "EPSG:31370",
      bbox: "104528,188839.75,105040,189351.75",
    });
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    if (this._cacheActief) {
      this.dispatch(prt.ActiveerCacheVoorLaag(this._titel, logOnlyWrapper));

      this.bindToLifeCycle(
        merge(
          this.kaart.kaartClassicSubMsg$.lift(
            classicMsgSubscriptionCmdOperator(
              this.kaart.dispatcher,
              prt.PrecacheProgressSubscription(
                pipe(PrecacheProgressMsg, KaartClassicMsg)
              ),
              prt.LaatsteCacheRefreshSubscription(
                pipe(LaatsteCacheRefreshMsg, KaartClassicMsg)
              )
            )
          ),
          this.kaart.kaartClassicSubMsg$.pipe(
            ofType<PrecacheProgressMsg>("PrecacheProgress"),
            map((m) => (m.progress[this._titel] ? m.progress[this._titel] : 0)),
            distinctUntilChanged(),
            tap((progress) => this.precacheProgress.emit(progress))
          ),
          this.kaart.kaartClassicSubMsg$.pipe(
            ofType<LaatsteCacheRefreshMsg>("LaatsteCacheRefresh"),
            filter((m) =>
              option.fromNullable(m.laatsteCacheRefresh[this._titel]).isSome()
            ),
            map((m) => m.laatsteCacheRefresh[this._titel]),
            distinctUntilChanged(),
            tap((laatsteCacheRefresh) =>
              this.laatsteCacheRefresh.emit(laatsteCacheRefresh)
            )
          )
        )
      ).subscribe();
    }
    this.bindToLifeCycle(
      this.kaart.kaartClassicSubMsg$.pipe(
        ofType<PublishedKaartLocatiesMsg>("PublishedKaartLocaties"),
        map((loc) => loc.locaties),
        collectOption(flatten(this._titel)),
        distinctUntilChanged(infoSetoid.equals),
        tap((info) => this.laagLocaties.emit(info))
      )
    ).subscribe();
  }
}
