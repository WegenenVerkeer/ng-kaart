import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";
import { identity } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";
import { switchMap } from "rxjs/operators";

import { kaartLogger } from "../../kaart";
import { CachedFeatureLookup } from "../../kaart/cache/lookup";
import * as ke from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { NosqlFsSource } from "../../source/nosql-fs-source";
import { ofType } from "../../util";
import { asap } from "../../util/asap";
import { Consumer } from "../../util/function";
import { cachedFeaturesLookupReadyMsg, CachedFeaturesLookupReadyMsg, logOnlyWrapper } from "../messages";
import * as val from "../webcomponent-support/params";

import { ClassicVectorLaagLikeComponent } from "./classic-vector-laag-like.component";

export interface PrecacheFeatures {
  readonly wkt: string;
  readonly startMetLegeCache: boolean;
}

@Component({
  selector: "awv-kaart-nosqlfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicNosqlfsLaagComponent extends ClassicVectorLaagLikeComponent {
  _url = "/geolatte-nosqlfs";
  _database: string;
  _view = "default";
  _collection: string;
  _filter: string;
  _gebruikCache = false;
  _maxFeaturesInMemCache = 2500;
  _veldInfos: ke.VeldInfo[] = [];

  @Input()
  set url(param: string) {
    this._url = val.str(param, this._url);
  }

  @Input()
  set database(param: string) {
    this._database = val.str(param, this._database);
  }

  @Input()
  set clusterDistance(param: number) {
    this._clusterDistance = val.optNum(param);
  }

  @Input()
  set view(param: string) {
    this._view = val.str(param, this._view);
  }

  @Input()
  set collection(param: string) {
    this._collection = val.str(param, this._collection);
  }

  @Input()
  set filter(param: string) {
    this._filter = val.str(param, this._filter);
  }

  @Input()
  set gebruikCache(param: boolean) {
    this._gebruikCache = val.bool(param, this._gebruikCache);
  }

  @Input()
  set veldinfos(param: ke.VeldInfo[]) {
    this._veldInfos = val.veldInfoArray(param, this._veldInfos);
  }

  /** Deze waarde bepaalt hoeveel features er in geheugen bijgehouden worden (tussen verschillende fetches van de NosqlFS
     source) om te verhinderen dat ze opnieuw getekend moeten worden bij het verschuiven of uitzoomen van de kaart.
     Gebruik deze instelling alleen wanneer je weet dat het echt nodig is! Grotere waarden zorgen voor meer
     geheugengebruik maar features worden potentieel sneller getoond bij uitzoomen en verschuiven van de kaart. Het
     ideale is om bij de start van de applicatie te detecteren of die op een krachtig toestel aan het lopen is of niet.
     Voor een telefoon bijvoorbeeld zou dit bijvoorbeeld op 1000 gezet kunenn worden. De beste waarde kan best per
     applicatie bepaald worden obv performantietests. Sommige applicaties gebruiken features met meer en omvangrijkere
     properties dan andere. */
  @Input()
  set maxFeaturesInMemCache(param: number) {
    this._maxFeaturesInMemCache = val.num(param, this._maxFeaturesInMemCache);
  }

  private _cachedFeaturesProviderConsumer: Consumer<CachedFeatureLookup> = () => {};

  @Input()
  set precache(input: PrecacheFeatures) {
    if (input) {
      this.dispatch(prt.VulCacheVoorNosqlLaag(this._titel, input.wkt, input.startMetLegeCache, logOnlyWrapper));
    }
  }

  @Input()
  set offline(offline: boolean) {
    this.dispatch(prt.ZetOffline(this._titel, offline, logOnlyWrapper));
  }

  @Input()
  set cachedFeaturesProviderConsumer(input: Consumer<CachedFeatureLookup>) {
    if (input) {
      this._cachedFeaturesProviderConsumer = input;
      // Dit moet op de volgende execution gescheduled worden omdat de laag niet geregistreerd is op het moment dat de
      // eerste @Input gezet wordt.
      asap(() => this.dispatch(prt.VraagCachedFeaturesLookupCmd(this._titel, cachedFeaturesLookupReadyMsg)));
    }
  }

  constructor(injector: Injector) {
    super(injector);

    this.bindToLifeCycle(
      this.viewReady$.pipe(
        switchMap(() => this.kaart.kaartClassicSubMsg$.pipe(ofType<CachedFeaturesLookupReadyMsg>("CachedFeaturesLookupReady")))
      )
    ).subscribe(msg => {
      const lookup = msg.cacheLookupValidation.fold(fail => {
        const errMsg = fail.join(", ");
        kaartLogger.error("Kon geen query object maken: ", errMsg);
        return CachedFeatureLookup.fromFailureMessage(errMsg);
      }, identity);
      this._cachedFeaturesProviderConsumer(lookup);
    });
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this._titel,
      source: new NosqlFsSource(
        this._database,
        this._collection,
        this._url,
        option.fromNullable(this._view),
        option.fromNullable(this._filter),
        this._titel,
        this._maxFeaturesInMemCache,
        this._gebruikCache
      ),
      clusterDistance: this._clusterDistance,
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this._selecteerbaar,
      hover: this._hover,
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      offsetveld: this._offsetveld,
      velden: new Map<string, ke.VeldInfo>(this._veldInfos.map(vi => [vi.naam, vi] as [string, ke.VeldInfo])),
      verwijderd: false,
      // TODO: dit veld (en offsetveld en ident8) zijn eigenlijk stijl concerns en zouden beter naar daar verhuisd moet worden
      rijrichtingIsDigitalisatieZin: false,
      filter: option.fromNullable(this._filter)
    };
  }
}
