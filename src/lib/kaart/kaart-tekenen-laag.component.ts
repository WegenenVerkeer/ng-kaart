import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import { Observable } from "rxjs/Observable";
import { distinctUntilChanged, map } from "rxjs/operators";

import { ofType } from "../util/operators";
import { forEach, orElse } from "../util/option";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import * as ke from "./kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper, TekenMsg, tekenWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";
import { KaartComponent } from "./kaart.component";
import { determineStyle, determineStyleSelector } from "./laag-converter";

const TekenLaagNaam = "Tekenen van geometrie";
@Component({
  selector: "awv-kaart-tekenen-laag",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-tekenen-laag.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartTekenLaagComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  defaultlaagStyle: Array<ol.style.Style> = [
    /* We are using two different styles for the polygons:
     *  - The first style is for the polygons themselves.
     *  - The second style is to draw the vertices of the polygons.
     *    In a custom `geometry` function the vertices of a polygon are
     *    returned as `MultiPoint` geometry, which will be used to render
     *    the style.
     */
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "blue",
        width: 3
      }),
      fill: new ol.style.Fill({
        color: "rgba(0, 0, 255, 0.1)"
      })
    }),
    new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill: new ol.style.Fill({
          color: "orange"
        })
      }),
      geometry: function(feature) {
        // return the coordinates of the first ring of the polygon
        const coordinates = (feature.getGeometry() as ol.geom.Polygon).getCoordinates()[0];
        return new ol.geom.MultiPoint(coordinates);
      }
    })
  ];

  defaultDrawStyle = new ol.style.Style({
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

  private tekenenSettingsSubj: BehaviorSubject<Option<ke.TekenSettings>>;
  private changedGeometriesSubj: Subject<ol.geom.Geometry>;

  private drawInteraction: ol.interaction.Draw;
  private modifyInteraction: ol.interaction.Modify;
  private snapInteraction: ol.interaction.Snap;
  private overlays: Array<ol.Overlay> = [];

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.TekenenSubscription(tekenWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    const kaartObs: Observable<KaartWithInfo> = this.kaartComponent.kaartWithInfo$;
    this.bindToLifeCycle(kaartObs);

    kaartObs
      .pipe(
        distinctUntilChanged((k1, k2) => k1.geometryChangedSubj === k2.geometryChangedSubj), //
        map(kwi => kwi.geometryChangedSubj)
      )
      .subscribe(gcSubj => (this.changedGeometriesSubj = gcSubj));

    kaartObs
      .pipe(
        distinctUntilChanged((k1, k2) => k1.tekenenSettingsSubj === k2.tekenenSettingsSubj), //
        map(kwi => kwi.tekenenSettingsSubj)
      )
      .subscribe(tekenenSettingsSubj => {
        this.tekenenSettingsSubj = tekenenSettingsSubj;
      });

    this.internalMessage$.pipe(ofType<TekenMsg>("Teken")).subscribe(msg => {
      msg.settings.fold(
        () => this.stopMetTekenen(), //
        s => this.startMetTekenen() //
      );
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

    this.drawInteraction = this.createDrawInteraction(source);
    this.dispatch(prt.VoegInteractieToeCmd(this.drawInteraction));

    this.modifyInteraction = new ol.interaction.Modify({ source: source });
    this.dispatch(prt.VoegInteractieToeCmd(this.modifyInteraction));

    this.snapInteraction = new ol.interaction.Snap({ source: source });
    this.dispatch(prt.VoegInteractieToeCmd(this.snapInteraction));
  }

  stopMetTekenen(): void {
    this.dispatch(prt.VerwijderInteractieCmd(this.drawInteraction));
    this.dispatch(prt.VerwijderInteractieCmd(this.modifyInteraction));
    this.dispatch(prt.VerwijderInteractieCmd(this.snapInteraction));
    this.dispatch(prt.VerwijderOverlaysCmd(this.overlays));
    this.dispatch(prt.VerwijderLaagCmd(TekenLaagNaam, kaartLogOnlyWrapper));
  }

  createLayer(source: ol.source.Vector): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: TekenLaagNaam,
      source: source,
      styleSelector: orElse(
        this.tekenenSettingsSubj.getValue().chain(s => s.laagStyle), //
        () => determineStyleSelector(this.defaultlaagStyle)
      ),
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
    const [measureTooltipElement, measureTooltip] = this.createMeasureTooltip();

    const draw = new ol.interaction.Draw({
      source: source,
      type: this.tekenenSettingsSubj.getValue().fold(
        () => "LineString" as ol.geom.GeometryType, //
        settings => settings.geometryType
      ),
      style: this.tekenenSettingsSubj
        .getValue()
        .map(s => determineStyle(s.drawStyle, this.defaultDrawStyle))
        .getOrElseValue(this.defaultDrawStyle)
    });

    draw.on(
      "drawstart",
      event => {
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
