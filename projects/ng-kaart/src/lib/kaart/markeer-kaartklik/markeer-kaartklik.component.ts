import { Component, NgZone } from "@angular/core";
import { Function1, Function2 } from "fp-ts/lib/function";
import { none } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, map, switchMap } from "rxjs/operators";

import * as ss from "../../kaart/stijl-selector";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import * as ke from "../kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export const MarkeerKaartklikUiSelector = "MarkeerKaartklik";

export interface MarkeerKaartklikOpties {
  readonly markerStyle: ss.Stylish;
  readonly disabled: boolean;
}

const featureGen: Function2<ol.Coordinate, ss.Stylish, ol.Feature> = (location, style) => {
  const feature = new ol.Feature({
    geometry: new ol.geom.Point(location)
  });
  feature.setStyle(style);
  return feature;
};

export const defaultMarkerStyle = new ol.style.Style({
  image: new ol.style.Icon({
    anchor: [0.5, 1],
    anchorXUnits: "fraction",
    anchorYUnits: "fraction",
    scale: 1,
    opacity: 1,
    src: require("material-design-icons/maps/svg/production/ic_place_48px.svg")
  })
});

const defaultOpties: MarkeerKaartklikOpties = {
  markerStyle: defaultMarkerStyle,
  disabled: false
};

const markerLayerTitle = "markeerkaartkliklayer";

const markerLayer: ke.VectorLaag = {
  type: ke.VectorType,
  titel: markerLayerTitle,
  source: new ol.source.Vector(),
  clusterDistance: none,
  styleSelector: none,
  styleSelectorBron: none,
  selectieStyleSelector: none,
  hoverStyleSelector: none,
  selecteerbaar: false,
  hover: false,
  minZoom: 2,
  maxZoom: 15,
  velden: new Map<string, ke.VeldInfo>(),
  offsetveld: none,
  verwijderd: false,
  rijrichtingIsDigitalisatieZin: false,
  filter: none
};

const vervangFeatures: Function1<ol.Feature[], prt.VervangFeaturesCmd<KaartInternalMsg>> = features => ({
  type: "VervangFeatures",
  titel: markerLayer.titel,
  features: features,
  wrapper: kaartLogOnlyWrapper
});

@Component({
  selector: "awv-markeer-kaartklik",
  template: ""
})
export class MarkeerKaartklikComponent extends KaartChildComponentBase {
  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    this.viewReady$.subscribe(() =>
      this.dispatch({
        type: "VoegLaagToe",
        positie: 0,
        laag: markerLayer,
        magGetoondWorden: true,
        laaggroep: "Tools",
        legende: none,
        stijlInLagenKiezer: none,
        filterinstellingen: none,
        wrapper: kaartLogOnlyWrapper
      })
    );
    this.destroying$.subscribe(() =>
      this.dispatch({
        type: "VerwijderLaag",
        titel: markerLayer.titel,
        wrapper: kaartLogOnlyWrapper
      })
    );

    const opties$ = this.accumulatedOpties$(MarkeerKaartklikUiSelector, defaultOpties);
    const kliklocatie$ = this.modelChanges.kaartKlikLocatie$.pipe(map(ki => ki.coordinate));
    const otherActive$ = this.modelChanges.actieveModus$.pipe(map(maybeModus => maybeModus.isSome()));

    const wis$ = rx.combineLatest(opties$, otherActive$, (o, a) => o.disabled || a).pipe(distinctUntilChanged());

    const markerFeature$ = rx
      .combineLatest(opties$, otherActive$, (a, b) => [a, b] as [MarkeerKaartklikOpties, boolean])
      .pipe(
        switchMap(([opties, otherActive]) =>
          opties.disabled || otherActive ? rx.empty() : kliklocatie$.pipe(map(locatie => featureGen(locatie, opties.markerStyle)))
        )
      );

    this.bindToLifeCycle(markerFeature$).subscribe(feature => this.dispatch(vervangFeatures([feature])));
    this.bindToLifeCycle(wis$).subscribe(() => this.dispatch(vervangFeatures([])));
  }
}
