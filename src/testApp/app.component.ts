import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";

import { Component, ViewChild, ViewEncapsulation } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import { KaartClassicComponent } from "../lib/kaart";
import { classicLogger } from "../lib/kaart-classic/log";
import { kaartLogOnlyWrapper } from "../lib/kaart/kaart-internal-messages";
import * as prt from "../lib/kaart/kaart-protocol";
import { definitieToStyle, kaartLogger } from "../lib/public_api";
import { AWV0StyleFunctionDescription, definitieToStyleFunction } from "../lib/stijl";
import { offsetStyleFunction } from "../lib/stijl/offset-stijl-function";
import { GoogleLocatieZoekerService } from "../lib/zoeker";

@Component({
  selector: "awv-ng-kaart-test-app",
  templateUrl: "./app.component.html",
  styleUrls: ["app.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  @ViewChild("verplaats") private verplaatsKaart: KaartClassicComponent;
  @ViewChild("selectie") private selectieKaart: KaartClassicComponent;

  private readonly zichtbaarheid = {
    orthomap: true,
    metenVoorbeeld: true,
    kleursimpel: false // standard falsey
  };

  private readonly fietspadStijlDef: AWV0StyleFunctionDescription = {
    version: "awv-v0",
    definition: {
      rules: [
        {
          condition: {
            kind: "==",
            left: { kind: "Property", type: "string", ref: "typefietspad" },
            right: { kind: "Literal", value: "Vrijliggend" }
          },
          style: {
            definition: { stroke: { color: "green", width: 4 } }
          }
        },
        {
          condition: {
            kind: "==",
            left: { kind: "Property", type: "string", ref: "typefietspad" },
            right: { kind: "Literal", value: "Aanliggend Verhoogd" }
          },
          style: {
            definition: { stroke: { color: "#FFFF00", width: 4 } }
          }
        },
        {
          condition: {
            kind: "==",
            left: { kind: "Property", type: "string", ref: "typefietspad" },
            right: { kind: "Literal", value: "Aanliggend" }
          },
          style: {
            definition: { stroke: { color: "#FF7F00", width: 4 } }
          }
        }
      ]
    }
  };

  polygoonEvents: string[] = [];
  installatieGeselecteerdEvents: string[] = [];
  geoJsonFormatter = new ol.format.GeoJSON();

  locatieQuery: string;
  installatieCoordinaat: ol.Coordinate = [169500, 190500];
  installaties: ol.Feature[] = [];
  installatie: ol.Feature[] = [
    new ol.Feature({
      id: 1,
      laag: "Fietspaden",
      ident8: "R0010001",
      type: "Vrijliggend",
      geometry: new ol.geom.Point(this.installatieCoordinaat)
    })
  ];
  zoekresultaten: ol.Collection<ol.Feature> = new ol.Collection();
  vanPositie = 0;
  naarPositie = 0;

  pinIcon = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: "fraction",
      anchorYUnits: "fraction",
      scale: 1,
      opacity: 1,
      src: require("material-design-icons/maps/svg/production/ic_place_48px.svg")
    }),
    text: new ol.style.Text({
      font: "12px 'Helvetica Neue', sans-serif",
      fill: new ol.style.Fill({ color: "#000" }),
      offsetY: -60,
      stroke: new ol.style.Stroke({
        color: "#fff",
        width: 2
      }),
      text: "Zis is a pin"
    })
  });

  geselecteerdeFeatures: List<ol.Feature> = List();

  private tekenenActief = false;
  private getekendeGeom: Option<ol.geom.Geometry> = none;

  // Dit werkt alleen als apigateway bereikbaar is. Zie CORS waarschuwing in README.
  readonly districtSource: ol.source.Vector = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function(extent) {
      return (
        `http://apigateway/geoserver/wfs/?service=WFS&version=1.1.0&request=GetFeature&` +
        `typename=awv:districten&` +
        "outputFormat=application/json&srsname=EPSG:31370&" +
        `bbox=${extent.join(",")},EPSG:31370`
      );
    },
    strategy: ol.loadingstrategy.bbox
  });

  readonly districtStyle: ol.style.Style = definitieToStyle(
    "json",
    '{"version": "awv-v0", "definition": {"stroke": {"color": "rgba(0,127,255,0.8)", "width": 1.5}}}'
  ).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  readonly kolkStyle: ol.style.Style = definitieToStyle(
    "json",
    // tslint:disable-next-line:max-line-length
    '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "navy", "width": 1.5}, "fill": {"color": "dodgerblue"}, "radius": 6}}}'
  ).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  readonly fietspadStyle: ol.StyleFunction = definitieToStyleFunction(
    "json",
    // tslint:disable-next-line:max-line-length
    JSON.stringify(this.fietspadStijlDef)
  ).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  fietspadStyleMetOffset = offsetStyleFunction(this.fietspadStyle, "ident8", "zijderijbaan", 1);

  fietspadSelectieStyleMetOffset = function(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
    const applySelectionColor = function(s: ol.style.Style): ol.style.Style {
      const selectionStyle = s.clone();
      selectionStyle.getStroke().setColor([0, 153, 255, 1]);
      return selectionStyle;
    };
    const offsetFunc = offsetStyleFunction(this!.fietspadStyle, "ident8", "zijderijbaan", 1);
    const style = offsetFunc(feature, resolution);
    if (style instanceof ol.style.Style) {
      return applySelectionColor(style);
    } else {
      return style.map(s => applySelectionColor(s));
    }
  }.bind(this);

  constructor(private googleLocatieZoekerService: GoogleLocatieZoekerService) {
    kaartLogger.setLevel("DEBUG");
    classicLogger.setLevel("DEBUG");
    this.addIcon();
  }

  isZichtbaar(part: string): boolean {
    return this.zichtbaarheid[part];
  }

  maakZichtbaar(part: string, zichtbaar: boolean) {
    this.zichtbaarheid[part] = zichtbaar;
  }

  private addIcon() {
    if (this.installaties.length > 20) {
      this.installaties = [];
    }
    const locatie: [number, number] = [
      this.installatieCoordinaat[0] + (Math.random() - 0.5) * 3000,
      this.installatieCoordinaat[1] + (Math.random() - 0.5) * 3000
    ];

    const feature = new ol.Feature({
      id: this.installaties.length,
      laag: "Fietspaden",
      ident8: "R0010001",
      type: "Vrijliggend",
      geometry: new ol.geom.Point(locatie)
    });
    feature.setStyle(this.pinIcon);
    this.installaties.push(feature);
    setTimeout(() => this.addIcon(), 1000);
  }

  polygoonGetekend(feature: ol.Feature) {
    this.polygoonEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  installatieGeselecteerd(feature: ol.Feature) {
    this.installatieGeselecteerdEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  featuresGeselecteerd(event: List<ol.Feature>) {
    // verwijder de bestaande info boodschappen voor features die niet meer geselecteerd zijn
    const nietLangerGeselecteerd = this.geselecteerdeFeatures //
      .filter(feature => !event.map(f => f.getId()).contains(feature.get("id")));
    nietLangerGeselecteerd.forEach(feature => this.selectieKaart.verbergInfoBoodschap(feature.get("id").toString()));

    // voeg de nieuwe toe
    this.geselecteerdeFeatures = event;
    this.geselecteerdeFeatures.forEach(feature =>
      this.selectieKaart //
        .toonInfoBoodschap(
          feature.get("id").toString(),
          feature.get("laag"),
          `Id: ${feature.get("id")}<br>` + //
          `Ident8: ${feature.get("ident8")}<br>` + //
            `Type: ${feature.get("type")}`
        )
    );
  }

  zoekLocaties(locatieQuery: String) {
    this.googleLocatieZoekerService
      .zoek(locatieQuery)
      .flatMap(res => res.resultaten)
      .map(zoekresultaat => zoekresultaat.geometry)
      .map(geometry => new ol.Feature(geometry))
      .subscribe(feature => this.zoekresultaten.push(feature));
  }

  isTekenenActief() {
    return this.tekenenActief;
  }

  startTekenen() {
    this.tekenenActief = true;
  }

  stopTekenen() {
    this.tekenenActief = false;
    this.getekendeGeom = none;
  }

  get tekenGeomLength() {
    return this.getekendeGeom
      .filter(g => g.getType() === "LineString" || g.getType() === "Polygon")
      .map(g => Math.round(ol.Sphere.getLength(g) / 1000 * 100) / 100 + "km")
      .getOrElseValue("(leeg)");
  }

  geomGetekend(geom: ol.geom.Geometry) {
    this.getekendeGeom = some(geom);
  }

  verplaatsLagen() {
    // TODO: Dit werkt niet, maar ik laat het voorlopig staan tot de inspiratie komt om het te laten werken.
    // Het probleem is dat het Subject waarnaar gedispatched wordt een ander is dan dat dat door de kaartcomponent
    // opgepikt wordt. Een issue in de volgorde van initialisatie???
    this.verplaatsKaart.dispatch(prt.VerplaatsLaagCmd("dienstkaart-kleur", this.naarPositie, kaartLogOnlyWrapper));
  }
}
