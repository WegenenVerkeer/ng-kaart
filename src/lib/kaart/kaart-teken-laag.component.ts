import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { Subject, Subscription } from "rxjs";
import { Observable } from "rxjs/Observable";
import { distinctUntilChanged, map, tap, skipUntil, skipWhile } from "rxjs/operators";

import { ofType } from "../util/operators";
import { forEach, orElse } from "../util/option";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import * as ke from "./kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper, TekenMsg, tekenWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { KaartComponent } from "./kaart.component";
import { determineStyle, determineStyleSelector } from "./laag-converter";

export const TekenenUISelector = "Kaarttekenen";
const TekenLaagNaam = "Tekenen van geometrie";
const defaultlaagStyle = new ol.style.Style({
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
const defaultDrawStyle = new ol.style.Style({
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
});
@Component({
  selector: "awv-kaart-teken-laag",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-teken-laag.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartTekenLaagComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private changedGeometriesSubj: Subject<ol.geom.Geometry>;

  private drawInteraction: ol.interaction.Draw;
  private modifyInteraction: ol.interaction.Modify;
  private snapInteraction: ol.interaction.Snap;
  private overlays: Array<ol.Overlay> = [];

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.TekenenSubscription(tekenWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.bindToLifeCycle(
      this.kaartModel$.pipe(
        distinctUntilChanged((k1, k2) => k1.geometryChangedSubj === k2.geometryChangedSubj), //
        map(kwi => kwi.geometryChangedSubj)
      )
    ).subscribe(gcSubj => (this.changedGeometriesSubj = gcSubj));

    this.bindToLifeCycle(
      this.kaartModel$.pipe(
        map(kwi => kwi.tekenSettingsSubj.getValue()), //
        distinctUntilChanged(),
        skipWhile(settings => settings.isNone()) // De eerste keer willen we startMetTekenen emitten
      )
    ).subscribe(settings => {
      settings.fold(
        () => this.stopMetTekenen(), //
        ts => this.startMetTekenen(ts) //
      );
    });
  }

  ngOnDestroy(): void {
    this.stopMetTekenen();
    super.ngOnDestroy();
  }

  private startMetTekenen(tekenSettings: ke.TekenSettings): void {
    const source = new ol.source.Vector();
    this.dispatch({
      type: "VoegLaagToe",
      positie: 0,
      laag: this.createLayer(source, tekenSettings),
      magGetoondWorden: true,
      laaggroep: "Tools",
      wrapper: kaartLogOnlyWrapper
    });

    this.drawInteraction = this.createDrawInteraction(source, tekenSettings);
    this.dispatch(prt.VoegInteractieToeCmd(this.drawInteraction));

    this.modifyInteraction = new ol.interaction.Modify({ source: source });
    this.dispatch(prt.VoegInteractieToeCmd(this.modifyInteraction));

    this.snapInteraction = new ol.interaction.Snap({ source: source });
    this.dispatch(prt.VoegInteractieToeCmd(this.snapInteraction));
  }

  private stopMetTekenen(): void {
    this.dispatch(prt.VerwijderInteractieCmd(this.drawInteraction));
    this.dispatch(prt.VerwijderInteractieCmd(this.modifyInteraction));
    this.dispatch(prt.VerwijderInteractieCmd(this.snapInteraction));
    this.dispatch(prt.VerwijderOverlaysCmd(this.overlays));
    this.dispatch(prt.VerwijderLaagCmd(TekenLaagNaam, kaartLogOnlyWrapper));
  }

  private createLayer(source: ol.source.Vector, tekenSettings: ke.TekenSettings): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: TekenLaagNaam,
      source: source,
      styleSelector: orElse(tekenSettings.laagStyle, () => determineStyleSelector(defaultlaagStyle)),
      selecteerbaar: true,
      minZoom: 2,
      maxZoom: 15
    };
  }

  private createMeasureTooltip(): [HTMLDivElement, ol.Overlay] {
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

  private createDrawInteraction(source: ol.source.Vector, tekenSettings: ke.TekenSettings): ol.interaction.Draw {
    const [measureTooltipElement, measureTooltip] = this.createMeasureTooltip();

    const draw = new ol.interaction.Draw({
      source: source,
      type: tekenSettings.geometryType,
      style: determineStyle(tekenSettings.drawStyle, defaultDrawStyle)
    });

    draw.on(
      "drawstart",
      (event: ol.interaction.Draw.Event) => {
        (event as ol.interaction.Draw.Event).feature.getGeometry().on(
          "change",
          evt => {
            const geometry = evt.target as ol.geom.Geometry;
            this.changedGeometriesSubj.next(geometry);
            forEach(this.tooltipText(geometry), toolTip => (measureTooltipElement.innerHTML = toolTip));
            forEach(this.tooltipCoord(geometry), coord => measureTooltip.setPosition(coord));
          },
          this
        );
      },
      this
    );

    draw.on(
      "drawend", //
      () => this.dispatch(prt.VerwijderInteractieCmd(this.drawInteraction)), //
      this
    );

    return draw;
  }

  tooltipText(geometry: ol.geom.Geometry): Option<string> {
    switch (geometry.getType()) {
      case "Polygon":
        return some(this.formatArea(geometry));
      case "LineString":
        return some(this.formatLength(geometry));
      default:
        return none;
    }
  }

  tooltipCoord(geometry: ol.geom.Geometry): Option<ol.Coordinate> {
    switch (geometry.getType()) {
      case "Polygon":
        return some((geometry as ol.geom.Polygon).getInteriorPoint().getCoordinates());
      case "LineString":
        return some((geometry as ol.geom.LineString).getLastCoordinate());
      default:
        return none;
    }
  }

  formatArea(geometry: ol.geom.Geometry): string {
    const area = ol.Sphere.getArea(geometry);
    return area > 10000
      ? Math.round(area / 1000000 * 100) / 100 + " " + "km<sup>2</sup>"
      : Math.round(area * 100) / 100 + " " + "m<sup>2</sup>";
  }

  formatLength(geometry: ol.geom.Geometry): string {
    const length = ol.Sphere.getLength(geometry);
    return length > 100 ? Math.round(length / 1000 * 100) / 100 + " " + "km" : Math.round(length * 100) / 100 + " " + "m";
  }
}
