import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { Subject } from "rxjs";
import { distinctUntilChanged, map, skipWhile } from "rxjs/operators";
import * as uuid from "uuid";

import { Transparantie } from "../../transparantieeditor/transparantie";
import { dimensieBeschrijving } from "../../util/geometries";
import { observeOnAngular } from "../../util/observe-on-angular";
import * as ol from "../../util/openlayers-compat";
import { ofType } from "../../util/operators";
import { forEach } from "../../util/option";
import { KaartChildDirective } from "../kaart-child.directive";
import * as ke from "../kaart-elementen";
import { VeldInfo } from "../kaart-elementen";
import {
  KaartInternalMsg,
  kaartLogOnlyWrapper,
  tekenWrapper,
  VerwijderTekenFeatureMsg,
} from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { asStyleSelector, toStylish } from "../stijl-selector";

export const TekenenUiSelector = "Kaarttekenen";
export const TekenLaagNaam = "Tekenen van geometrie";
const defaultlaagStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "rgba(255, 255, 255, 0.2)",
  }),
  stroke: new ol.style.Stroke({
    color: "#ffcc33",
    width: 2,
  }),
  image: new ol.style.Circle({
    radius: 7,
    fill: new ol.style.Fill({
      color: "#ffcc33",
    }),
  }),
});
const defaultDrawStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "rgba(255, 255, 255, 0.2)",
  }),
  stroke: new ol.style.Stroke({
    color: "rgba(0, 0, 0, 0.5)",
    lineDash: [10, 10],
    width: 2,
  }),
  image: new ol.style.Circle({
    radius: 5,
    stroke: new ol.style.Stroke({
      color: "rgba(0, 0, 0, 0.7)",
    }),
    fill: new ol.style.Fill({
      color: "rgba(255, 255, 255, 0.2)",
    }),
  }),
});
@Component({
  selector: "awv-kaart-teken-laag",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-teken-laag.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class KaartTekenLaagComponent
  extends KaartChildDirective
  implements OnInit, OnDestroy {
  private changedGeometriesSubj: Subject<ke.Tekenresultaat>;

  private tekenen = false;
  private source: ol.source.Vector;
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

    // Verwijder de feature en tooltip.
    this.bindToLifeCycle(
      this.internalMessage$.pipe(
        ofType<VerwijderTekenFeatureMsg>("VerwijderTekenFeature"), //
        observeOnAngular(this.zone)
      )
    ).subscribe((msg) => {
      const feature = this.source.getFeatureById(msg.featureId);
      if (feature) {
        const tooltip = feature.get("measuretooltip") as ol.Overlay;
        if (tooltip) {
          this.dispatch(prt.VerwijderOverlaysCmd([tooltip]));
        }
        this.source.removeFeature(feature);
      }
    });

    // Hou de subject bij.
    this.bindToLifeCycle(
      this.kaartModel$.pipe(
        distinctUntilChanged(
          (k1, k2) => k1.geometryChangedSubj === k2.geometryChangedSubj
        ), //
        map((kwi) => kwi.geometryChangedSubj)
      )
    ).subscribe((gcSubj) => (this.changedGeometriesSubj = gcSubj));

    this.bindToLifeCycle(
      this.kaartModel$.pipe(
        map((kwi) => kwi.tekenSettingsSubj.getValue()), //
        distinctUntilChanged(),
        skipWhile((settings) => option.isNone(settings)) // De eerste keer willen we startMetTekenen emitten
      )
    ).subscribe((settings) => {
      option.fold(
        () => this.stopMetTekenen(), //
        (ts: ke.TekenSettings) => this.startMetTekenen(ts) //
      )(settings);
    });
  }

  ngOnDestroy(): void {
    this.stopMetTekenen();
    super.ngOnDestroy();
  }

  private startMetTekenen(tekenSettings: ke.TekenSettings): void {
    if (this.tekenen) {
      this.stopMetTekenen();
    }

    this.source = option.fold(
      () => new ol.source.Vector(),
      (geom: ol.geom.Geometry) => {
        const source = new ol.source.Vector();
        source.addFeature(new ol.Feature(geom));
        return source;
      }
    )(tekenSettings.geometry);
    this.dispatch({
      type: "VoegLaagToe",
      positie: 0,
      laag: this.createLayer(this.source, tekenSettings),
      magGetoondWorden: true,
      transparantie: Transparantie.opaak,
      laaggroep: "Tools",
      legende: option.none,
      stijlInLagenKiezer: option.none,
      filterinstellingen: option.none,
      laagtabelinstellingen: option.none,
      wrapper: kaartLogOnlyWrapper,
    });

    this.drawInteraction = this.createDrawInteraction(
      this.source,
      tekenSettings
    );
    this.dispatch(prt.VoegInteractieToeCmd(this.drawInteraction));

    this.modifyInteraction = new ol.interaction.Modify({ source: this.source });
    this.dispatch(prt.VoegInteractieToeCmd(this.modifyInteraction));

    this.snapInteraction = new ol.interaction.Snap({ source: this.source });
    this.dispatch(prt.VoegInteractieToeCmd(this.snapInteraction));

    this.tekenen = true;
  }

  private stopMetTekenen(): void {
    if (this.tekenen) {
      this.dispatch(prt.VerwijderInteractieCmd(this.drawInteraction));
      this.dispatch(prt.VerwijderInteractieCmd(this.modifyInteraction));
      this.dispatch(prt.VerwijderInteractieCmd(this.snapInteraction));
      this.dispatch(prt.VerwijderOverlaysCmd(this.overlays));
      this.dispatch(prt.VerwijderLaagCmd(TekenLaagNaam, kaartLogOnlyWrapper));
    }
    this.tekenen = false;
  }

  private createLayer(
    source: ol.source.Vector,
    tekenSettings: ke.TekenSettings
  ): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: TekenLaagNaam,
      source: source,
      clusterDistance: option.none,
      styleSelector: pipe(
        tekenSettings.laagStyle,
        option.alt(() => asStyleSelector(defaultlaagStyle))
      ),
      styleSelectorBron: option.none,
      selectieStyleSelector: option.none,
      hoverStyleSelector: option.none,
      selecteerbaar: false,
      hover: false,
      minZoom: 2,
      maxZoom: 15,
      offsetveld: option.none,
      velden: new Map<string, VeldInfo>(),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false,
      filter: option.none,
    };
  }

  private createMeasureTooltip(): [HTMLDivElement, ol.Overlay] {
    const measureTooltipElement: HTMLDivElement = document.createElement("div");
    measureTooltipElement.className = "tooltip tooltip-measure";
    const measureTooltip = new ol.Overlay({
      element: measureTooltipElement,
      offset: [0, -15],
      positioning: ol.overlay.Positioning.BOTTOM_CENTER,
    });

    this.dispatch({
      type: "VoegOverlayToe",
      overlay: measureTooltip,
    });

    this.overlays.push(measureTooltip);

    return [measureTooltipElement, measureTooltip];
  }

  private initializeFeature(
    feature: ol.Feature,
    meerdereGeometrieen: Boolean
  ): void {
    const [measureTooltipElement, measureTooltip] = this.createMeasureTooltip();
    const volgnummer = this.volgendeVolgnummer();
    feature.set("volgnummer", volgnummer);
    feature.set("measuretooltip", measureTooltip);
    feature.setId(uuid.v4());
    feature.getGeometry()!.on("change", (evt) => {
      // TODO na OL upgrade -> is this pointer OK?
      const geometry = evt.target as ol.geom.Geometry;
      this.changedGeometriesSubj.next(
        ke.TekenResultaat(geometry, volgnummer, feature.getId()!)
      );
      const omschrijving = dimensieBeschrijving(geometry, false);
      measureTooltipElement.innerHTML = meerdereGeometrieen
        ? volgnummer + ": " + omschrijving
        : omschrijving;
      forEach(this.tooltipCoord(geometry), (coord) =>
        measureTooltip.setPosition(coord)
      );
    });
    feature.getGeometry()!.changed();
  }

  private createDrawInteraction(
    source: ol.source.Vector,
    tekenSettings: ke.TekenSettings
  ): ol.interaction.Draw {
    const draw = new ol.interaction.Draw({
      source: source,
      type: tekenSettings.geometryType,
      style: pipe(
        tekenSettings.drawStyle,
        option.map(toStylish),
        option.getOrElse(() => defaultDrawStyle)
      ),
    });

    source.forEachFeature((feature) =>
      this.initializeFeature(feature, tekenSettings.meerdereGeometrieen)
    );

    draw.on(
      // TODO na OL upgrade -> is this pointer OK?
      "drawstart",
      (event: ol.interaction.DrawEvent) => {
        const feature = event.feature;
        this.initializeFeature(feature, tekenSettings.meerdereGeometrieen);
      }
    );

    draw.on(
      // TODO na OL upgrade -> is this pointer OK?
      "drawend",
      () => {
        if (!tekenSettings.meerdereGeometrieen) {
          // Als we maar 1 geometrie open mogen hebben, stoppen we direct met tekenen wanneer 1 geometrie afgesloten is.
          this.dispatch(prt.VerwijderInteractieCmd(this.drawInteraction));
        }
      }
    );

    return draw;
  }

  private volgendeVolgnummer(): number {
    const maxVolgNummer = this.source
      .getFeatures()
      .map((feature) => option.fromNullable(feature.get("volgnummer")))
      .filter((optional) => option.isSome(optional))
      .map((optional) => option.toNullable(optional))
      .reduce(
        (maxVolgNummer: number, volgNummer: number) =>
          Math.max(maxVolgNummer, volgNummer),
        0
      );
    return maxVolgNummer + 1;
  }

  tooltipCoord(geometry: ol.geom.Geometry): option.Option<ol.Coordinate> {
    switch (geometry.getType()) {
      case "Polygon":
        return option.some(
          (geometry as ol.geom.Polygon).getInteriorPoint().getCoordinates()
        );
      case "LineString":
        return option.some(
          (geometry as ol.geom.LineString).getLastCoordinate()
        );
      default:
        return option.none;
    }
  }
}
