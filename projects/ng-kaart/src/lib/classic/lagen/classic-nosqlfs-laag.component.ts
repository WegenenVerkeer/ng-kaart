import { Component, Input, NgZone, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";
import { fromNullable } from "fp-ts/lib/Option";
import { OrderedMap } from "immutable";

import * as ke from "../../kaart/kaart-elementen";
import * as ss from "../../kaart/stijl-selector";
import { NosqlFsSource } from "../../source/nosql-fs-source";
import * as featureStore from "../../util/geojson-store";
import { KaartClassicComponent } from "../kaart-classic.component";

import { ClassicVectorLaagLikeComponent } from "./classic-vector-laag-like.component";

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

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(kaart, zone);
  }

  private source: NosqlFsSource = null;

  createLayer(): ke.VectorLaag {
    this.source = new NosqlFsSource(
      this.database,
      this.collection,
      this.url,
      option.fromNullable(this.view),
      option.fromNullable(this.filter),
      this.titel,
      this.gebruikCache
    );

    return {
      type: ke.VectorType,
      titel: this.titel,
      source: this.source,
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this.selecteerbaar,
      hover: this.hover,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      offsetveld: fromNullable(this.offsetveld),
      velden: OrderedMap<string, ke.VeldInfo>(),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false
      // TODO: dit veld (en offsetveld en ident8) zijn eigenlijk stijl concerns en zouden beter naar daar verhuisd moet worden
    };
  }

  private verwijderFeatures(startMetLegeCache: boolean) {
    return startMetLegeCache ? featureStore.clear(this.collection) : Promise.resolve();
  }

  precacheLayer(extent: ol.Extent, startMetLegeCache: boolean) {
    if (this.source) {
      this.verwijderFeatures(startMetLegeCache).then(() =>
        this.source.fetchFeatures(extent, feature => featureStore.writeFeature(this.collection, feature))
      );
    }
  }
}
