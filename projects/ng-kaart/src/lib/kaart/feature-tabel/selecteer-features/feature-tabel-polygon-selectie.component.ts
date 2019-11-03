import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { MatIconRegistry } from "@angular/material";
import { DomSanitizer } from "@angular/platform-browser";
import { default as booleanIntersects } from "@turf/boolean-intersects";
import * as turf from "@turf/turf";
import * as array from "fp-ts/lib/Array";
import { Function1, Function2, identity } from "fp-ts/lib/function";
import * as option from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { filter, map, tap, withLatestFrom } from "rxjs/operators";

import * as clr from "../../../stijl/colour";
import { GeometryMapper, matchGeometryType } from "../../../util";
import { subSpy } from "../../../util/operators";
import { encodeAsSvgUrl } from "../../../util/url";
import { KaartModusComponent } from "../../kaart-modus-component";
import * as prt from "../../kaart-protocol";
import { DeselecteerAlleFeaturesCmd, DrawOpsCmd, VerwijderUiElement, VoegUiElementToe } from "../../kaart-protocol-commands";
import { KaartComponent } from "../../kaart.component";
import { MultiTekenenUiSelector } from "../../tekenen/kaart-multi-teken-laag.component";
import { EndDrawing, StartDrawing } from "../../tekenen/tekenen-model";
import { FeatureTabelInklapComponent } from "../feature-tabel-inklap.component";

// tslint:disable-next-line: max-line-length
const viaPolygonSVG = `<svg width="100%" height="100%" viewBox="0 0 24 24" style="fill-rule:evenodd;clip-rule:evenodd;stroke-miterlimit:10;">
  <clipPath id="_clip1"><rect id="icons-toolbar-001" x="1.354" y="-19.5" width="84" height="63"/></clipPath>
  <g clip-path="url(#_clip1)"><g id="Toolbar">
    <g id="Ruler"><rect x="1.354" y="22.5" width="21" height="21" style="fill:none;"/>
      <path d="M4.854,29.5l0,3" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
      <path d="M6.854,29.5l0,4" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
      <path d="M8.854,29.5l0,3" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
      <path d="M10.854,29.5l0,4" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
      <path d="M12.854,29.5l0,3" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
      <path d="M14.854,29.5l0,4" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
      <path d="M16.854,29.5l0,3" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
      <path d="M18.854,29.5l0,4" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1px;"/>
    </g>
    <g id="Zoom_out"></g>
    <g id="Zoom_in"></g>
    <g id="Poly_tool_three">
      <rect x="22.354" y="1.5" width="21" height="21" style="fill:none;"/>
      <path d="M35.354,6.5l-7,7l9,4l1.328,-6.92" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1.4px;"/>
      <circle cx="28.354" cy="13.5" r="2" style="fill:#fff;stroke:black;stroke-width:0.8px;"/>
    </g>
    <g id="Poly_tool_four">
      <path d="M14.354,7.5l-8,-1l3,11l8,-2l2,-6.445" style="fill:none;fill-rule:nonzero;stroke:black;stroke-width:1.4px;"/>
      <circle cx="6.354" cy="6.5" r="2" style="fill:#fff;stroke:black;stroke-width:0.8px;"/>
      <circle cx="14.354" cy="7.5" r="2" style="fill:#fff;stroke:black;stroke-width:0.8px;"/>
      <circle cx="9.354" cy="17.5" r="2" style="fill:#fff;stroke:black;stroke-width:0.8px;"/>
      <circle cx="17.354" cy="15.5" r="2" style="fill:#fff;stroke:black;stroke-width:0.8px;"/>
      <rect x="1.354" y="1.5" width="21" height="21" style="fill:none;"/>
    </g>
    <g id="Pan_tool"></g>
    <g id="Pin_tool"></g>
    <g id="blacko_arrow"><rect x="22.354" y="-19.5" width="21" height="21" style="fill:none;"/></g>
    <g id="Undo_arrow"><rect x="1.354" y="-19.5" width="21" height="21" style="fill:none;"/></g>
  </g>
  </g>
  </svg>`;

export interface SelecteerFeaturesViaPolygonOpties {
  readonly markColour: clr.Kleur;
  readonly useRouting: boolean;
  readonly polygonStyleFunction: ol.StyleFunction;
}

const defaultPolygonStyleFunction: Function2<ol.Feature, number, ol.style.Style[]> = (f, resolution) => [
  new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: clr.kleurcodeValue(clr.zwart),
      width: 3
    }),
    fill: new ol.style.Fill({
      color: clr.kleurcodeValue(clr.transparantgrijs)
    })
  })
];

const defaultOptions: SelecteerFeaturesViaPolygonOpties = {
  markColour: clr.zwart,
  useRouting: false,
  polygonStyleFunction: defaultPolygonStyleFunction
};

export const SelecteerFeaturesViaPolygonModusSelector = "SelecteerFeaturesViaPolygon";

@Component({
  selector: "awv-feature-tabel-polygon-selectie",
  templateUrl: "./feature-tabel-polygon-selectie.component.html",
  styleUrls: []
})
export class FeatureTabelSelectieViaPolygonComponent extends KaartModusComponent implements OnInit, OnDestroy {
  public zichtbaar$: rx.Observable<boolean>;
  private opties: SelecteerFeaturesViaPolygonOpties = defaultOptions;
  private inklap: FeatureTabelInklapComponent;

  constructor(
    parent: KaartComponent,
    zone: NgZone,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitize: DomSanitizer,
    inklap: FeatureTabelInklapComponent
  ) {
    super(parent, zone);
    this.inklap = inklap;

    this.matIconRegistry.addSvgIcon(
      "selecteer-via-polygon",
      this.domSanitize.bypassSecurityTrustResourceUrl(encodeAsSvgUrl(viaPolygonSVG))
    );

    const turfMapper: GeometryMapper<turf.Feature<turf.Geometry, turf.Properties>> = {
      lineString: l => turf.lineString(l.getCoordinates()),
      point: p => turf.point(p.getCoordinates())
    };

    const olToTurf: Function1<ol.geom.Geometry, option.Option<turf.Feature<turf.Geometry, turf.Properties>>> = geometry =>
      matchGeometryType(geometry, turfMapper);

    const geometryToPolygon: Function1<ol.geom.Geometry, option.Option<turf.Feature<turf.Polygon, turf.Properties>>> = geometry => {
      const edges = <Array<ol.geom.LineString>>(<ol.geom.GeometryCollection>geometry).getGeometries();
      const coordinates = array.flatten(array.map((l: ol.geom.LineString) => l.getCoordinates())(edges));
      coordinates.push(coordinates[0]);
      if (coordinates.length < 4) {
        return option.none;
      } else {
        return option.some(turf.polygon([coordinates]));
      }
    };

    const drawingDone$ = this.modelChanges.tekenenOps$.pipe(filter(drawOps => drawOps.type === "StopDrawing"));

    const selectFeatures$ = drawingDone$.pipe(
      withLatestFrom(this.isActief$, this.modelChanges.getekendeGeometry$, this.modelChanges.zichtbareFeatures$),
      map(([_, actief, getekendeGeometry, zichtbareFeatures]) => {
        if (actief) {
          const maybePolygon = geometryToPolygon(getekendeGeometry);
          return maybePolygon.map(polygon =>
            zichtbareFeatures.filter(zichtbareFeature =>
              olToTurf(zichtbareFeature.getGeometry()).exists(g => booleanIntersects(g, polygon))
            )
          );
        } else {
          return option.none;
        }
      }),
      tap(mfs => mfs.map(features => this.dispatch(prt.SelecteerExtraFeaturesCmd(features))))
    );

    this.zichtbaar$ = this.modelChanges.tabelState$.pipe(map(tsc => tsc.state === "Opengeklapt"));

    this.runInViewReady(
      rx.merge(
        this.wordtActief$.pipe(tap(() => this.startSelectie())), //
        this.wordtInactief$.pipe(tap(() => this.stopSelectie())),
        drawingDone$, // ik moet hier subscriben, anders komt er niks binnen in features$, jammer
        selectFeatures$
      )
    );
  }

  modus(): string {
    return SelecteerFeaturesViaPolygonModusSelector;
  }

  private startSelectie(): void {
    this.inklap.toggleTabelZichtbaar();
    this.dispatch(DeselecteerAlleFeaturesCmd());
    this.dispatch(VoegUiElementToe(MultiTekenenUiSelector));
    this.dispatch(DrawOpsCmd(EndDrawing()));
    this.dispatch(DrawOpsCmd(StartDrawing(this.opties.markColour, this.opties.useRouting, option.some(this.opties.polygonStyleFunction))));
  }

  private stopSelectie(): void {
    this.zetModeAf();
    this.dispatch(DrawOpsCmd(EndDrawing()));
    this.dispatch(VerwijderUiElement(MultiTekenenUiSelector));
  }
}
