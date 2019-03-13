import { Component, Input, NgZone, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";
import { identity } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";
import * as rx from "rxjs";
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
import { KaartClassicComponent } from "../kaart-classic.component";
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
  gebruikCache = false;
  @Input()
  veldinfos: ke.VeldInfo[] = [];

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

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(kaart, zone);

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
        this.gebruikCache
      ),
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this.selecteerbaar,
      hover: this.hover,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      offsetveld: fromNullable(this.offsetveld),
      velden: new Map<string, ke.VeldInfo>(this.veldinfos.map(vi => [vi.naam, vi] as [string, ke.VeldInfo])),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false
      // TODO: dit veld (en offsetveld en ident8) zijn eigenlijk stijl concerns en zouden beter naar daar verhuisd moet worden
    };
  }
}
