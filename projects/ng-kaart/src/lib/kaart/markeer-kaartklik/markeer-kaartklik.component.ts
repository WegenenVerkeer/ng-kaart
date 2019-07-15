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
    anchor: [0.5, 0.5],
    anchorXUnits: "fraction",
    anchorYUnits: "fraction",
    scale: 0.5,
    opacity: 1,
    src:
      // tslint:disable-next-line: max-line-length
      "data:image/svg+xml;charset=utf-8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiB2aWV3Qm94PSIwIDAgODkgODkiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGZpbHRlciBpZD0iZmlsdGVyNDcxMSIgeD0iLS4wNzIiIHk9Ii0uMDcyIiB3aWR0aD0iMS4xNDQiIGhlaWdodD0iMS4xNDQiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iMC4xODMwNjAwMSIvPjwvZmlsdGVyPjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtLjE4MjUgOS4wNzcpIj48ZyB0cmFuc2Zvcm09Im1hdHJpeCg0LjkxOSAwIDAgNC45MTkgLTM3LjM4IC00Mi4xOSkiIGZpbGwtb3BhY2l0eT0iLjI1MSI+PGNpcmNsZSBjeD0iMTAuNjkiIGN5PSI5Ljc4IiByPSIzLjA1MSIgZmlsbC1vcGFjaXR5PSIuMjUxIi8+PC9nPjwvZz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtLjE4MjUgOS4wNzcpIj48ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjcxNCAwIDAgMS43MTQgLTMuMTE0IC0xMC44NSkiIGZpbHRlcj0idXJsKCNmaWx0ZXI0NzExKSI+PGNpcmNsZSBjeD0iMTAuNjkiIGN5PSI5Ljc4IiByPSIzLjA1MSIvPjwvZz48ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjU1OSAwIDAgMS41NTkgLTEuNDU2IC05LjMzMSkiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIuMzA5Ij48Y2lyY2xlIGN4PSIxMC42OSIgY3k9IjkuNzgiIHI9IjMuMDUxIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iLjMwOSIvPjwvZz48ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0MiAwIDAgMS4wMTUgMjAuNjMgLTMyLjQ5KSI+PHBhdGggZD0ibTEwLjUgMTguMTZ2LTcuNjU3IiBmaWxsPSJub25lIi8+PC9nPjxnIHRyYW5zZm9ybT0ibWF0cml4KC41NTI3IDAgMCAuNTUyNyA5LjMgLS45OTc1KSIgZmlsbD0iI2ZmZiI+PGNpcmNsZSBjeD0iMTAuNjkiIGN5PSI5Ljc4IiByPSIzLjA1MSIgZmlsbD0iI2ZmZiIvPjwvZz48ZyB0cmFuc2Zvcm09Im1hdHJpeCguNjg1NSAwIDAgLjM3NzYgOC4wMDkgMi4yNTYpIiBmaWxsPSIjZmZmIj48cGF0aCBkPSJtMTEuMiAxOC4wMXMtMC43MjQyIDAuNzAwOS0xLjQwNiAwdi03LjY1N2MwLjYwMDggMC41NTk3IDEuNDA2IDAgMS40MDYgMHoiIGZpbGw9IiNmZmYiLz48L2c+PC9nPjwvc3ZnPg=="
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
