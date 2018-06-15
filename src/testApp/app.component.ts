import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";

import { Component, ElementRef, ViewChild, ViewEncapsulation } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import { KaartClassicComponent } from "../lib/classic/kaart-classic.component";
import { classicLogger } from "../lib/classic/log";
import { kaartLogOnlyWrapper } from "../lib/kaart/kaart-internal-messages";
import * as prt from "../lib/kaart/kaart-protocol";
import { definitieToStyle, kaartLogger } from "../lib/public_api";
import { AWV0StyleFunctionDescription, definitieToStyleFunction } from "../lib/stijl";
import { offsetStyleFunction } from "../lib/stijl/offset-stijl-function";
import { join } from "../lib/util/validation";
import { ZoekerGoogleWdbService } from "../lib/zoeker";

export interface FietspadSelectie {
  feature: ol.Feature;
  geselecteerd: boolean;
}

@Component({
  selector: "awv-ng-kaart-test-app",
  templateUrl: "./app.component.html",
  styleUrls: ["app.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  @ViewChild("verplaats") private verplaatsKaart: KaartClassicComponent;
  @ViewChild("selectie") private selectieKaart: KaartClassicComponent;

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
      laagnaam: "Fietspaden",
      properties: {
        ident8: "R0010001",
        typefietspad: "Vrijliggend"
      },
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

  pinIcon2 = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: "fraction",
      anchorYUnits: "fraction",
      scale: 1,
      opacity: 1,
      color: "#FA1",
      src: require("material-design-icons/maps/svg/production/ic_local_airport_48px.svg")
    }),
    text: new ol.style.Text({
      font: "12px 'Helvetica Neue', sans-serif",
      fill: new ol.style.Fill({ color: "#0AF" }),
      offsetY: -60,
      stroke: new ol.style.Stroke({
        color: "#fff",
        width: 2
      }),
      text: "Feature 2"
    })
  });

  geselecteerdeFeatures: List<ol.Feature> = List();

  fietspadsegmentenSelectie: FietspadSelectie[] = [];
  geselecteerdeFietspadsegmenten: List<ol.Feature> = List();

  private tekenenActief = false;
  private getekendeGeom: Option<ol.geom.Geometry> = none;

  private alleVoorwaarden = ["Er zijn nieuwe voorwaarden", "Er zijn nog nieuwere voorwaarden", undefined];
  voorwaarden = this.alleVoorwaarden[0];
  private voorwaardenIndex = 0;

  objectKeys = Object.keys;
  mogelijkeWidgets = {
    fixedHeaderLinksBoven: true,
    zoeker: true,
    lagenkiezer: true,
    standaardinteracties: true,
    achtergrond: true,
    streetview: true,
    zoomknoppen: true,
    mijnlocatie: true,
    meten: true,
    schaal: true,
    voorwaarden: true,
    copyright: true
  };

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
  ).getOrElseL(msg => {
    throw new Error(`slecht formaat ${join(msg)}`);
  });

  readonly kolkStyle: ol.style.Style = definitieToStyle(
    "json",
    // tslint:disable-next-line:max-line-length
    '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "navy", "width": 1.5}, "fill": {"color": "dodgerblue"}, "radius": 6}}}'
  ).getOrElseL(msg => {
    throw new Error(`slecht formaat ${join(msg)}`);
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
      return style ? style.map(s => applySelectionColor(s)) : [];
    }
  }.bind(this);

  constructor(private googleLocatieZoekerService: ZoekerGoogleWdbService) {
    kaartLogger.setLevel("DEBUG");
    classicLogger.setLevel("DEBUG");
    this.addIcon();
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
      laagnaam: "Fietspaden",
      properties: {
        ident8: "R0010001",
        typefietspad: "Vrijliggend"
      },
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
    nietLangerGeselecteerd.forEach(feature => this.selectieKaart.verbergIdentifyInformatie(feature.get("id").toString()));

    // voeg de nieuwe toe
    this.geselecteerdeFeatures = event;
    this.geselecteerdeFeatures.forEach(feature => this.selectieKaart.toonIdentifyInformatie(feature));
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
      .getOrElse("(leeg)");
  }

  geomGetekend(geom: ol.geom.Geometry) {
    this.getekendeGeom = some(geom);
  }

  veranderVoorwaarden() {
    this.voorwaardenIndex = (this.voorwaardenIndex + 1) % this.alleVoorwaarden.length;
    this.voorwaarden = this.alleVoorwaarden[this.voorwaardenIndex];
  }

  isInteractieZichtbaar(interactie: string): boolean {
    return this.mogelijkeWidgets[interactie];
  }

  toggleInteractieZichtbaar(interactie: string) {
    this.mogelijkeWidgets[interactie] = !this.mogelijkeWidgets[interactie];
  }

  getMijnLocatieZoom(): string {
    if (this.mogelijkeWidgets["mijnlocatie"]) {
      return "8";
    } else {
      return null;
    }
  }

  verplaatsLagen() {
    // TODO: Dit werkt niet, maar ik laat het voorlopig staan tot de inspiratie komt om het te laten werken.
    // Het probleem is dat het Subject waarnaar gedispatched wordt een ander is dan dat dat door de kaartcomponent
    // opgepikt wordt. Een issue in de volgorde van initialisatie???
    this.verplaatsKaart.dispatch(prt.VerplaatsLaagCmd("dienstkaart-kleur", this.naarPositie, kaartLogOnlyWrapper));
  }

  // De volgende methodes loggen gewoon naar de console. Er is weinig toegevoegde waarde om hier een UI voor te maken.
  onZoom(zoom: number): void {
    console.log("------> zoom", zoom);
  }

  onMiddelpunt(center: ol.Coordinate): void {
    console.log("------> center", center);
  }

  onExtent(extent: ol.Extent): void {
    console.log("------> extent", extent);
  }

  onZichtbareFeatures(features: List<ol.Feature>): void {
    console.log("------> features", features);
  }

  onFietspadsegmentenZichtbaar(features: List<ol.Feature>): void {
    this.fietspadsegmentenSelectie = features
      .map(feature => ({
        feature: feature,
        geselecteerd: false
      }))
      .toArray();
    this.geselecteerdeFietspadsegmenten = List();
  }

  onFietspadsegmentGeselecteerd(selectie: FietspadSelectie, geselecteerd: boolean) {
    selectie.geselecteerd = geselecteerd;
    this.geselecteerdeFietspadsegmenten = List(this.fietspadsegmentenSelectie.filter(fss => fss.geselecteerd).map(fss => fss.feature));
  }

  onFietspadsegmentViaKaartSelectie(features: List<ol.Feature>) {
    this.fietspadsegmentenSelectie.forEach(fss => (fss.geselecteerd = features.contains(fss.feature)));
    if (features.size !== this.geselecteerdeFietspadsegmenten.size) {
      this.geselecteerdeFietspadsegmenten = List(this.fietspadsegmentenSelectie.filter(fss => fss.geselecteerd).map(fss => fss.feature));
    }
  }

  scrollTo(idName: string): void {
    const element = document.getElementById(idName);
    element.scrollIntoView({ behavior: "smooth" });
  }
}
