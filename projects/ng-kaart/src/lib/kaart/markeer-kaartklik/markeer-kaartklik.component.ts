import { Component, NgZone } from "@angular/core";
import { eq, map as maps, option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import * as rx from "rxjs";
import {
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  pairwise,
  switchMap,
} from "rxjs/operators";

import * as ss from "../../kaart/stijl-selector";
import { Transparantie } from "../../transparantieeditor/transparantie";
import { ofType } from "../../util";
import * as ol from "../../util/openlayers-compat";
import { KaartChildDirective } from "../kaart-child.directive";
import * as ke from "../kaart-elementen";
import {
  InfoBoodschappenMsg,
  KaartInternalMsg,
  kaartLogOnlyWrapper,
} from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { OptiesRecord } from "../ui-element-opties";

export const MarkeerKaartklikUiSelector = "MarkeerKaartklik";

export interface MarkeerKaartklikOpties extends OptiesRecord {
  readonly markerStyle: ss.Stylish;
  readonly disabled: boolean;
  readonly includeFeatureClick: boolean;
  readonly id: string;
}

const featureGen: (location: ol.Coordinate, style: ss.Stylish) => ol.Feature = (
  location,
  style
) => {
  const feature = new ol.Feature({
    geometry: new ol.geom.Point(location),
  });
  feature.setStyle(style);
  return feature;
};

export const defaultMarkerStyle = new ol.style.Style({
  image: new ol.style.Icon({
    anchor: [0.5, 0.5],
    anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
    anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
    scale: 0.5,
    opacity: 1,
    src:
      // eslint-disable-next-line max-len
      "data:image/svg+xml;utf8;charset=utf-8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiB3aWR0aD0iNzEiIGhlaWdodD0iNzEiIHZpZXdCb3g9IjAgMCAzMCAzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJmaWx0ZXI0NzExIiB4PSItLjA3MiIgeT0iLS4wNzIiIHdpZHRoPSIxLjE0NCIgaGVpZ2h0PSIxLjE0NCIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIwLjE4MzA2MDAxIi8+PC9maWx0ZXI+PC9kZWZzPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0uMTgyNSA5LjA3NykiPjxnIHRyYW5zZm9ybT0ibWF0cml4KDQuOTE5IDAgMCA0LjkxOSAtMzcuMzggLTQyLjE5KSIgZmlsbC1vcGFjaXR5PSIuMjUxIj48Y2lyY2xlIGN4PSIxMC42OSIgY3k9IjkuNzgiIHI9IjMuMDUxIiBmaWxsLW9wYWNpdHk9Ii4yNTEiLz48L2c+PC9nPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0uMTgyNSA5LjA3NykiPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNzE0IDAgMCAxLjcxNCAtMy4xMTQgLTEwLjg1KSIgZmlsdGVyPSJ1cmwoI2ZpbHRlcjQ3MTEpIj48Y2lyY2xlIGN4PSIxMC42OSIgY3k9IjkuNzgiIHI9IjMuMDUxIi8+PC9nPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNTU5IDAgMCAxLjU1OSAtMS40NTYgLTkuMzMxKSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9Ii4zMDkiPjxjaXJjbGUgY3g9IjEwLjY5IiBjeT0iOS43OCIgcj0iMy4wNTEiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIuMzA5Ii8+PC9nPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuODQyIDAgMCAxLjAxNSAyMC42MyAtMzIuNDkpIj48cGF0aCBkPSJtMTAuNSAxOC4xNnYtNy42NTciIGZpbGw9Im5vbmUiLz48L2c+PGcgdHJhbnNmb3JtPSJtYXRyaXgoLjU1MjcgMCAwIC41NTI3IDkuMyAtLjk5NzUpIiBmaWxsPSIjZmZmIj48Y2lyY2xlIGN4PSIxMC42OSIgY3k9IjkuNzgiIHI9IjMuMDUxIiBmaWxsPSIjZmZmIi8+PC9nPjxnIHRyYW5zZm9ybT0ibWF0cml4KC42ODU1IDAgMCAuMzc3NiA4LjAwOSAyLjI1NikiIGZpbGw9IiNmZmYiPjxwYXRoIGQ9Im0xMS4yIDE4LjAxcy0wLjcyNDIgMC43MDA5LTEuNDA2IDB2LTcuNjU3YzAuNjAwOCAwLjU1OTcgMS40MDYgMCAxLjQwNiAweiIgZmlsbD0iI2ZmZiIvPjwvZz48L2c+PC9zdmc+",
  }),
});

const defaultOpties: MarkeerKaartklikOpties = {
  markerStyle: defaultMarkerStyle,
  disabled: false,
  includeFeatureClick: false,
  id: "default",
};

const markerLayerTitle = "markeerkaartkliklayer";

const markerLayer: ke.VectorLaag = {
  type: ke.VectorType,
  titel: markerLayerTitle,
  source: new ol.source.Vector(),
  clusterDistance: option.none,
  styleSelector: option.none,
  styleSelectorBron: option.none,
  selectieStyleSelector: option.none,
  hoverStyleSelector: option.none,
  selecteerbaar: false,
  hover: false,
  minZoom: 2,
  maxZoom: 15,
  velden: new Map<string, ke.VeldInfo>(),
  offsetveld: option.none,
  verwijderd: false,
  rijrichtingIsDigitalisatieZin: false,
  filter: option.none,
};

const vervangFeatures: (
  features: ol.Feature[]
) => prt.VervangFeaturesCmd<KaartInternalMsg> = (features) => ({
  type: "VervangFeatures",
  titel: markerLayer.titel,
  features: features,
  wrapper: kaartLogOnlyWrapper,
});

export const ZetMaarkeerKaartklikOptiesCmd = (
  opties: Partial<MarkeerKaartklikOpties>
): prt.ZetUiElementOpties =>
  prt.ZetUiElementOpties(MarkeerKaartklikUiSelector, opties);

@Component({
  selector: "awv-markeer-kaartklik",
  template: "",
})
export class MarkeerKaartklikComponent extends KaartChildDirective {
  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    this.viewReady$.subscribe(() =>
      this.dispatch({
        type: "VoegLaagToe",
        positie: 0,
        laag: markerLayer,
        magGetoondWorden: true,
        transparantie: Transparantie.opaak,
        laaggroep: "Tools",
        legende: option.none,
        stijlInLagenKiezer: option.none,
        filterinstellingen: option.none,
        laagtabelinstellingen: option.none,
        wrapper: kaartLogOnlyWrapper,
      })
    );
    this.destroying$.subscribe(() =>
      this.dispatch({
        type: "VerwijderLaag",
        titel: markerLayer.titel,
        wrapper: kaartLogOnlyWrapper,
      })
    );

    this.dispatch(
      prt.InitUiElementOpties(MarkeerKaartklikUiSelector, defaultOpties)
    );
    const opties$ = this.accumulatedOpties$<MarkeerKaartklikOpties>(
      MarkeerKaartklikUiSelector
    );
    const kaartKlik$ = this.modelChanges.kaartKlikLocatie$;
    const otherActive$ = this.modelChanges.actieveModus$.pipe(
      map((maybeModus) => option.isSome(maybeModus))
    );

    const identifyBoodschapGesloten$ = this.internalMessage$.pipe(
      ofType<InfoBoodschappenMsg>("InfoBoodschappen"), // enkel de lijst van boodschappen intereseert ons
      map((msg) =>
        pipe(
          maps.lookup(eq.eqString)("kaart_bevragen", msg.infoBoodschappen),
          option.isSome // was er een kaart bevragen boodschap bij?
        )
      ),
      distinctUntilChanged(),
      pairwise(), // combineer met de vorige
      filter(([before, after]) => before && !after) // bingo als er eerst een was en nu niet meer
    );

    const wis$ = rx
      .merge(
        rx.combineLatest(opties$, otherActive$, (o, a) => o.disabled || a),
        identifyBoodschapGesloten$
      )
      .pipe(distinctUntilChanged());

    const markerFeature$ = rx.combineLatest(opties$, otherActive$).pipe(
      switchMap(([opties, otherActive]) =>
        opties.disabled || otherActive
          ? rx.EMPTY
          : kaartKlik$.pipe(
              filter(
                (klik) => !klik.coversFeature || opties.includeFeatureClick
              ),
              map((klik) => featureGen(klik.coordinate, opties.markerStyle))
            )
      )
    );

    this.dispatchCmdsInViewReady(
      markerFeature$.pipe(map((feature) => vervangFeatures([feature]))), //
      wis$.pipe(mapTo(vervangFeatures([])))
    );
  }
}
