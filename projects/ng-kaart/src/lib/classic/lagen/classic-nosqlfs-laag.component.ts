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
import * as val from "../classic-validators";
import { cachedFeaturesLookupReadyMsg, CachedFeaturesLookupReadyMsg, logOnlyWrapper } from "../messages";

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
  @Input()
  url = "/geolatte-nosqlfs";
  @Input()
  database: string;
  @Input()
  view = "default";
  @Input()
  collection: string;
  @Input()
  filter: string;
  @Input()
  veldinfos: ke.VeldInfo[] = [];
  /* Deze waarde bepaalt hoeveel features er in geheugen bijgehouden worden (tussen verschillende fetches van de NosqlFS
     source) om te verhinderen dat ze opnieuw getekend moeten worden bij het verschuiven of uitzoomen van de kaart.
     Gebruik deze instelling alleen wanneer je weet dat het echt nodig is! Grotere waarden zorgen voor meer
     geheugengebruik maar features worden potentieel sneller getoond bij uitzoomen en verschuiven van de kaart. Het
     ideale is om bij de start van de applicatie te detecteren of die op een krachtig toestel aan het lopen is of niet.
     Voor een telefoon bijvoorbeeld zou dit bijvoorbeeld op 1000 gezet kunenn worden. De beste waarde kan best per
     applicatie bepaald worden obv performantietests. Sommige applicaties gebruiken features met meer en omvangrijkere
     properties dan andere. */

  _gebruikCache = false;
  _maxFeaturesInMemCache = 2500;

  @Input()
  set gebruikCache(param: string | boolean) {
    val.bool(param, val => (this._gebruikCache = val));
  }

  @Input()
  set maxFeaturesInMemCache(param: string | number) {
    val.num(param, val => (this._maxFeaturesInMemCache = val));
  }

  private _cachedFeaturesProviderConsumer: Consumer<CachedFeatureLookup> = () => {};

  @Input()
  set precache(input: PrecacheFeatures) {
    if (input) {
      this.dispatch(prt.VulCacheVoorNosqlLaag(this.titel, input.wkt, input.startMetLegeCache, logOnlyWrapper));
    }
  }

  @Input()
  set offline(offline: boolean) {
    this.dispatch(prt.ZetOffline(this.titel, offline, logOnlyWrapper));
  }

  @Input()
  set cachedFeaturesProviderConsumer(input: Consumer<CachedFeatureLookup>) {
    if (input) {
      this._cachedFeaturesProviderConsumer = input;
      // Dit moet op de volgende execution gescheduled worden omdat de laag niet geregistreerd is op het moment dat de
      // eerste @Input gezet wordt.
      asap(() => this.dispatch(prt.VraagCachedFeaturesLookupCmd(this.titel, cachedFeaturesLookupReadyMsg)));
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
      titel: this.titel,
      source: new NosqlFsSource(
        this.database,
        this.collection,
        this.url,
        option.fromNullable(this.view),
        option.fromNullable(this.filter),
        this.titel,
        this._maxFeaturesInMemCache,
        this._gebruikCache
      ),
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this.selecteerbaar,
      hover: this.hover,
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      offsetveld: fromNullable(this.offsetveld),
      velden: new Map<string, ke.VeldInfo>(this.veldinfos.map(vi => [vi.naam, vi] as [string, ke.VeldInfo])),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false
      // TODO: dit veld (en offsetveld en ident8) zijn eigenlijk stijl concerns en zouden beter naar daar verhuisd moet worden
    };
  }
}
