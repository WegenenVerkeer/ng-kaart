import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { Subject, Subscription } from "rxjs";
import { Observable } from "rxjs/Observable";
import { distinctUntilChanged, filter, map } from "rxjs/operators";

import { ofType } from "../util/operators";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import * as ke from "./kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper, SubscribedMsg, TekenMsg, tekenWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { KaartComponent } from "./kaart.component";
import { kaartLogger } from "./log";

const TekenLaagNaam = "Tekenen van geometrie";
const TekenStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "rgba(255, 255, 255, 0.2)"
  }),
  stroke: new ol.style.Stroke({
    color: "#ffcc33",
    width: 2
  }),
  image: new ol.style.Circle({
    radius: 7,
    fill: new ol.style.Fill({
      color: "#ffcc33"
    })
  })
});

@Component({
  selector: "awv-kaart-tekenen",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-tekenen.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartTekenLaagComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private map: ol.Map;
  private changedGeometriesSubj: Subject<ol.geom.Geometry>;

  private draw: ol.interaction.Draw;
  private overlays: Array<ol.Overlay> = [];

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.TekenenSubscription(tekenWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    const kaartObs: Observable<KaartWithInfo> = this.kaartComponent.kaartModel$;
    this.bindToLifeCycle(kaartObs);

    kaartObs
      .pipe(
        distinctUntilChanged((k1, k2) => k1.geometryChangedSubj === k2.geometryChangedSubj), //
        map(kaart => kaart.geometryChangedSubj)
      )
      .subscribe(gcSubj => (this.changedGeometriesSubj = gcSubj));

    this.internalMessage$.pipe(ofType<TekenMsg>("Teken")).subscribe(msg => {
      if (msg.teken) {
        this.startMetTekenen();
      } else {
        this.stopMetTekenen();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopMetTekenen();
    super.ngOnDestroy();
  }

  startMetTekenen(): void {
    const source = new ol.source.Vector();
    this.dispatch({
      type: "VoegLaagToe",
      positie: 0,
      laag: this.createLayer(source),
      magGetoondWorden: true,
      laaggroep: "Tools",
      wrapper: kaartLogOnlyWrapper
    });

    this.draw = this.createDrawInteraction(source);

    this.dispatch(prt.VoegInteractieToeCmd(this.draw));
  }

  stopMetTekenen(): void {
    this.dispatch(prt.VerwijderInteractieCmd(this.draw));
    this.dispatch(prt.VerwijderOverlaysCmd(this.overlays));
    this.dispatch(prt.VerwijderLaagCmd(TekenLaagNaam, kaartLogOnlyWrapper));
  }

  createLayer(source: ol.source.Vector): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: TekenLaagNaam,
      source: source,
      styleSelector: some(ke.StaticStyle(TekenStyle)),
      selecteerbaar: true,
      minZoom: 2,
      maxZoom: 15
    };
  }

  createMeasureTooltip(): [HTMLDivElement, ol.Overlay] {
    const measureTooltipElement: HTMLDivElement = document.createElement("div");
    measureTooltipElement.className = "tooltip tooltip-measure";
    const measureTooltip = new ol.Overlay({
      element: measureTooltipElement,
      offset: [0, -15],
      positioning: "bottom-center"
    });

    this.dispatch({
      type: "VoegOverlayToe",
      overlay: measureTooltip
    });

    this.overlays.push(measureTooltip);

    return [measureTooltipElement, measureTooltip];
  }

  createDrawInteraction(source: ol.source.Vector): ol.interaction.Draw {
    let listener;
    let [measureTooltipElement, measureTooltip] = this.createMeasureTooltip();

    const draw = new ol.interaction.Draw({
      source: source,
      type: "LineString",
      style: new ol.style.Style({
        fill: new ol.style.Fill({
          color: "rgba(255, 255, 255, 0.2)"
        }),
        stroke: new ol.style.Stroke({
          color: "rgba(0, 0, 0, 0.5)",
          lineDash: [10, 10],
          width: 2
        }),
        image: new ol.style.Circle({
          radius: 5,
          stroke: new ol.style.Stroke({
            color: "rgba(0, 0, 0, 0.7)"
          }),
          fill: new ol.style.Fill({
            color: "rgba(255, 255, 255, 0.2)"
          })
        })
      })
    });

    draw.on(
      "drawstart",
      event => {
        // set sketch
        const sketch = (event as ol.interaction.Draw.Event).feature;

        listener = sketch.getGeometry().on(
          "change",
          evt => {
            const geometry = evt.target as ol.geom.Geometry;
            let output;
            let tooltipCoord;
            if (geometry instanceof ol.geom.Polygon) {
              output = this.formatArea(geometry);
              // console.log(output);
              tooltipCoord = geometry.getInteriorPoint().getCoordinates();
            } else if (geometry instanceof ol.geom.LineString) {
              output = this.formatLength(geometry);
              // console.log(output);
              tooltipCoord = geometry.getLastCoordinate();
            }
            this.changedGeometriesSubj.next(geometry);
            measureTooltipElement.innerHTML = output;
            measureTooltip.setPosition(tooltipCoord);
          },
          this
        );
      },
      this
    );

    draw.on(
      "drawend",
      () => {
        measureTooltipElement.className = "tooltip tooltip-static";
        measureTooltip.setOffset([0, -7]);
        // unset sketch
        // this.sketch = null;
        // if (measureTooltipElement.parentNode) {
        //   measureTooltipElement.parentNode.removeChild(measureTooltipElement);
        // }

        // unset tooltip so that a new one can be created
        // measureTooltipElement = null;
        [measureTooltipElement, measureTooltip] = this.createMeasureTooltip();
        ol.Observable.unByKey(listener);
      },
      this
    );

    return draw;
  }

  formatArea(polygon: ol.geom.Polygon): String {
    const area = ol.Sphere.getArea(polygon);
    let output;
    if (area > 10000) {
      output = Math.round(area / 1000000 * 100) / 100 + " " + "km<sup>2</sup>";
    } else {
      output = Math.round(area * 100) / 100 + " " + "m<sup>2</sup>";
    }
    return output;
  }

  formatLength(line: ol.geom.LineString): String {
    const length = ol.Sphere.getLength(line);
    let output;
    if (length > 100) {
      output = Math.round(length / 1000 * 100) / 100 + " " + "km";
    } else {
      output = Math.round(length * 100) / 100 + " " + "m";
    }
    return output;
  }
}
