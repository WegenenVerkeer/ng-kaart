import { animate, style, transition, trigger } from "@angular/animations";
import { Component, ViewChild, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";

import { KaartClassicComponent } from "../lib/classic/kaart-classic.component";
import { classicLogger } from "../lib/classic/log";
import { kaartLogOnlyWrapper } from "../lib/kaart/kaart-internal-messages";
import * as prt from "../lib/kaart/kaart-protocol";
import { definitieToStyle, kaartLogger, parseCoordinate, ToegevoegdeLaag } from "../lib/public_api";
import { AWV0StyleFunctionDescription, definitieToStyleFunction } from "../lib/stijl";
import { offsetStyleFunction } from "../lib/stijl/offset-stijl-function";
import { verkeersbordenStyleFunction } from "../lib/stijl/verkeersborden-stijl-function";
import { forEach } from "../lib/util/option";
import { join } from "../lib/util/validation";
import { zoekerMetPrioriteiten, ZoekerMetPrioriteiten } from "../lib/zoeker/zoeker";

import { DummyZoeker } from "./dummy-zoeker";

export interface FietspadSelectie {
  feature: ol.Feature;
  geselecteerd: boolean;
}

@Component({
  selector: "awv-feature-demo",
  templateUrl: "./feature-demo.component.html",
  styleUrls: ["feature-demo.component.scss"],
  animations: [
    trigger("enterAnimation", [
      transition(":enter", [
        style({ opacity: 0, "max-height": 0 }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 1, "max-height": "1000px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "1000px" }),
        animate("0.35s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None
})
export class FeatureDemoComponent {
  @ViewChild("verplaats")
  private verplaatsKaart: KaartClassicComponent;
  @ViewChild("selectie")
  private selectieKaart: KaartClassicComponent;

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
  verkeersbordenCoordinaat: ol.Coordinate = [154131, 208218];
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

  private alleVoorwaarden = ["Voorwaarden disclaimer", "Er zijn nieuwe voorwaarden", "Er zijn nog nieuwere voorwaarden"];
  voorwaarden = this.alleVoorwaarden[0];
  private voorwaardenIndex = 0;

  objectKeys = Object.keys;
  mogelijkeOpties = {
    // --- Algemeen
    optieDivider1: { divider: true, value: true, label: "Algemene opties" },
    standaardinteracties: { value: true, label: "Pannen en zoomen" },
    bevraagkaart: { value: true, label: "Bevraag kaart" },
    // --- Linkerpaneel
    optieDivider2: { divider: true, value: true, label: "Opties linker paneel" },
    zoeker: { value: true, label: "Zoeker" },
    lagenkiezer: { value: true, label: "Lagen" },
    lagenVerwijderbaar: { value: true, label: "Lagen verwijderbaar" },
    legende: { value: true, label: "Legende (enkel in combinatie met lagen)" },
    kaartLinksFixedHeader: { value: false, label: "Custom vaste header in linker paneel" },
    kaartLinksExtraElements: { value: false, label: "Custom extra elementen in linker paneel" },
    kaartLinksBreedte: { value: false, label: "Custom breedte van 300px (default: 480px bij > 1240px en 360px bij <= 1240px)" },

    // --- Widgets
    optieDivider3: { divider: true, value: true, label: "Widgets onderaan rechts" },
    achtergrond: { value: true, label: "Meerdere achtergrondlagen" },
    streetview: { value: true, label: "Streetview" },
    meten: { value: true, label: "Meten" },
    mijnlocatie: { value: true, label: "Mijn huidige locatie" },
    zoomknoppen: { value: true, label: "Zoomknoppen" },

    // --- Meten opties
    optieDivider3a: { divider: true, value: true, label: "Meten opties (teken modus op en afzetten na veranderingen)" },
    metenToon: { value: true, label: "Toon info" },
    metenMeerdere: { value: true, label: "Meerdere geometrieen" },

    // --- Kaartinfo
    optieDivider4: { divider: true, value: true, label: "Kaartinfo onderaan rechts" },
    schaal: { value: true, label: "Kaartschaal" },
    voorwaarden: { value: true, label: "Voorwaarden disclaimer" },
    copyright: { value: true, label: "Copyright boodschap" }
  };

  configuratorMiddelpunt = [130000, 193000];

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

  readonly verkeersbordenStyleFunction = verkeersbordenStyleFunction(false);
  readonly verkeersbordenSelectieStyleFunction = verkeersbordenStyleFunction(true);

  readonly fietspadStyleMetOffset = offsetStyleFunction(this.fietspadStyle, "ident8", "zijderijbaan", 1);

  readonly fietspadSelectieStyleMetOffset = function(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
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

  readonly fietspadenRefreshSubj = new rx.Subject<void>();
  readonly fietspadenRefresh$ = this.fietspadenRefreshSubj.asObservable();

  readonly demoZoekers: ZoekerMetPrioriteiten[] = [
    zoekerMetPrioriteiten(new DummyZoeker("dummy1"), 1, 1),
    zoekerMetPrioriteiten(new DummyZoeker("dummy2"), 2, 2),
    zoekerMetPrioriteiten(new DummyZoeker("dummy3"), 3, 3)
  ];

  constructor() {
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
    this.installaties = array.snoc(this.installaties, feature);
    setTimeout(() => this.addIcon(), 5000); // zorgt voor Angular Check event
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
      .map(g => Math.round((ol.Sphere.getLength(g) / 1000) * 100) / 100 + "km")
      .getOrElse("(leeg)");
  }

  geomGetekend(geom: ol.geom.Geometry) {
    this.getekendeGeom = some(geom);
  }

  veranderVoorwaarden() {
    this.voorwaardenIndex = (this.voorwaardenIndex + 1) % this.alleVoorwaarden.length;
    this.voorwaarden = this.alleVoorwaarden[this.voorwaardenIndex];
  }

  isOptieActief(optie: string): boolean {
    return this.mogelijkeOpties[optie].value;
  }

  toggleOptieActief(optie: string) {
    this.mogelijkeOpties[optie].value = !this.mogelijkeOpties[optie].value;
  }

  getMijnLocatieZoom(): string {
    if (this.mogelijkeOpties["mijnlocatie"].value) {
      return "8";
    } else {
      return null;
    }
  }

  getKaartLinksBreedte(): number {
    if (this.mogelijkeOpties["kaartLinksBreedte"].value) {
      return 300;
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

  stijlbareVectorlagen(titel: string) {
    return true;
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

  onAchtergrondLagen(lagen: List<ToegevoegdeLaag>): void {
    console.log("------> achtergrondlagen", lagen);
  }

  onVoorgrondHoogLagen(lagen: List<ToegevoegdeLaag>): void {
    console.log("------> voorgrond hoog lagen", lagen);
  }

  onVoorgrondLaagLagen(lagen: List<ToegevoegdeLaag>): void {
    console.log("------> voorgrond laag lagen", lagen);
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

  onRefreshFietspadenClicked() {
    this.fietspadenRefreshSubj.next();
  }

  scrollTo(idName: string): void {
    const element = document.getElementById(idName);
    element.scrollIntoView({ behavior: "smooth" });
  }

  onZetCenterManueel(coordTxt: string): void {
    forEach(parseCoordinate(coordTxt), (coords: [number, number]) => (this.configuratorMiddelpunt = coords));
  }
}
