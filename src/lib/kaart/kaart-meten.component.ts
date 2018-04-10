import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { Subject, ReplaySubject, Subscription } from "rxjs";
import { Observable } from "rxjs/Observable";
import { map, distinctUntilChanged, concatAll, mergeAll } from "rxjs/operators";
import * as ol from "openlayers";

import { KaartComponent } from "./kaart.component";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartClassicComponent } from "./kaart-classic.component";
import {
  KaartInternalMsg,
  KaartInternalSubMsg,
  kaartLogOnlyWrapper,
  metenLengteOppervlakteWrapper,
  MetenLengteOppervlakteMsg,
  SubscribedMsg,
  subscribedWrapper,
  GeometryChangedMsg,
  geometryChangedWrapper
} from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import * as ke from "./kaart-elementen";
import { ofType } from "../util/operators";
import { forEach } from "../util/option";
import { kaartLogger } from "./log";
import { MetenLengteOppervlakteCmd } from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";

const MetenLaagNaam = "Meten afstand en oppervlakte";
const MetenStyle = new ol.style.Style({
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
  selector: "awv-kaart-meten",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-meten.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartMetenLengteOppervlakteLaagComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private readonly subscriptions: prt.SubscriptionResult[] = [];

  private map: ol.Map;

  private changedGeometriesSubj: Subject<ol.geom.Geometry>;

  private draw: ol.interaction.Draw;
  private overlays: Array<ol.Overlay> = [];

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    // TODO geen casting meer in RxJS 6
    const kaartObs: Observable<KaartWithInfo> = this.kaartComponent.kaartModel$;
    this.bindToLifeCycle(kaartObs);

    kaartObs
      .pipe(map(kaart => kaart.geometryChangedSubj), distinctUntilChanged())
      .subscribe(gcSubj => (this.changedGeometriesSubj = gcSubj));

    this.kaartComponent.internalCmdDispatcher.dispatch(
      prt.SubscriptionCmd(prt.MetenLengteOppervlakteSubscription(metenLengteOppervlakteWrapper), subscribedWrapper({}))
    );
    this.kaartComponent.internalMessage$.pipe(ofType<MetenLengteOppervlakteMsg>("MetenLengteOppervlakte")).subscribe(msg => {
      if (msg.meten) {
        this.startMetMeten();
      } else {
        this.stopMetMeten();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopMetMeten();
  }

  startMetMeten(): void {
    const source = new ol.source.Vector();
    this.kaartComponent.internalCmdDispatcher.dispatch({
      type: "VoegLaagToe",
      positie: 0,
      laag: this.createLayer(source),
      magGetoondWorden: true,
      laaggroep: "Tools",
      wrapper: kaartLogOnlyWrapper
    });

    this.draw = this.createDrawInteraction(source);

    this.kaartComponent.internalCmdDispatcher.dispatch({
      type: "VoegInteractieToe",
      interactie: this.draw
    });

    this.kaartComponent.internalMessage$
      .pipe(ofType<SubscribedMsg>("Subscribed")) //
      .subscribe(sm =>
        sm.subscription.fold(
          kaartLogger.error, //
          sub => this.subscriptions.push(sub)
        )
      );
  }

  stopMetMeten(): void {
    this.kaartComponent.internalCmdDispatcher.dispatch({
      type: "VerwijderInteractie",
      interactie: this.draw
    });
    this.kaartComponent.internalCmdDispatcher.dispatch({
      type: "VerwijderOverlays",
      overlays: this.overlays
    });
    this.kaartComponent.internalCmdDispatcher.dispatch(prt.VerwijderLaagCmd(MetenLaagNaam, kaartLogOnlyWrapper));

    this.subscriptions.forEach(sub => this.kaartComponent.internalCmdDispatcher.dispatch(prt.UnsubscriptionCmd(sub)));
    this.subscriptions.splice(0, this.subscriptions.length);
  }

  createLayer(source: ol.source.Vector): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: MetenLaagNaam,
      source: source,
      styleSelector: some(ke.StaticStyle(MetenStyle)),
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

    this.kaartComponent.internalCmdDispatcher.dispatch({
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
