import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectorRef, Component, NgZone, ViewChild, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { CachedFeatureLookup } from "projects/ng-kaart/src/lib/kaart/cache/lookup";
import * as rx from "rxjs";
import { reduce } from "rxjs/operators";

import {
  AwvV0DynamicStyle,
  definitieToStyle,
  definitieToStyleFunction,
  forEach,
  join,
  KaartClassicComponent,
  offsetStyleFunction,
  parseCoordinate,
  PrecacheFeatures,
  PrecacheWMS,
  ToegevoegdeLaag,
  validateAwvV0RuleDefintion,
  VeldInfo,
  verkeersbordenStyleFunction,
  zoekerMetPrioriteiten,
  ZoekerMetPrioriteiten
} from "../../projects/ng-kaart/src/public_api";

import { DummyZoeker } from "./dummy-zoeker";
import { wkts } from "./wkts";

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

  constructor(private changeDetectorRef: ChangeDetectorRef, private readonly zone: NgZone) {
    this.addIcon();
  }

  private readonly fietspadStijlDef: AwvV0DynamicStyle = {
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
  };

  private readonly afgeleideSnelheidsRegimesStijlDef: AwvV0DynamicStyle = {
    rules: [
      {
        condition: {
          kind: "<=",
          left: { kind: "Property", type: "number", ref: "snelheid" },
          right: { kind: "Literal", value: 30 }
        },
        style: {
          definition: { stroke: { color: "blue", width: 4 } }
        }
      },
      {
        condition: {
          kind: ">=",
          left: { kind: "Property", type: "number", ref: "snelheid" },
          right: { kind: "Literal", value: 50 }
        },
        style: {
          definition: { stroke: { color: "black", width: 4 } }
        }
      }
    ]
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
  mechelenFeatures: ol.Feature[] = [
    new ol.Feature({
      id: 1,
      properties: {
        vorm: "punt",
        merk: "ACME",
        gesloten: false,
        legnte: 0
      },
      geometry: new ol.geom.Point([157562, 190726])
    }),
    new ol.Feature({
      id: 2,
      properties: {
        vorm: "punt",
        merk: "Globex",
        gesloten: false,
        lengte: 0
      },
      geometry: new ol.geom.Point([158149, 190676])
    }),
    new ol.Feature({
      id: 3,
      properties: {
        vorm: "punt",
        merk: "ACME",
        gesloten: false
        // geen lengte om terugvalkleur te testen
      },
      geometry: new ol.geom.Point([157758, 190810])
    }),
    new ol.Feature({
      id: 4,
      properties: {
        vorm: "lijn",
        merk: "Globex",
        gesloten: false,
        lengte: 10.0
      },
      geometry: new ol.geom.LineString([[157977, 190729], [158024, 190519], [158024, 190519]])
    }),
    new ol.Feature({
      id: 5,
      properties: {
        vorm: "lijn",
        merk: "ACME",
        gesloten: false,
        lengte: 20
      },
      geometry: new ol.geom.LineString([[157367, 191062], [157527, 190997], [157647, 190995]])
    }),
    new ol.Feature({
      id: 6,
      properties: {
        vorm: "cirkel",
        merk: "Globex",
        gesloten: true,
        lengte: 20
      },
      geometry: new ol.geom.Circle([157820, 190922], 100)
    }),
    new ol.Feature({
      id: 7,
      properties: {
        vorm: "veelvlak",
        merk: "ACME",
        gesloten: true,
        lengte: 30
      },
      geometry: new ol.geom.Polygon([[[157636, 190292], [157731, 190371], [157786, 190346], [157910, 190276], [157762, 190108]]])
    }),
    new ol.Feature({
      id: 8,
      properties: {}, // altijd fallback
      geometry: new ol.geom.Circle([157821, 190530], 50)
    })
  ];
  mechelenVeldInfos: VeldInfo[] = [
    {
      naam: "vorm",
      label: "Vorm",
      type: "string",
      isBasisVeld: true,
      constante: undefined,
      template: undefined,
      uniekeWaarden: ["punt", "lijn", "cirkel", "veelvlak"],
      html: ""
    },
    {
      naam: "merk",
      label: "Merk",
      type: "string",
      isBasisVeld: true,
      constante: undefined,
      template: undefined,
      uniekeWaarden: ["ACME", "Globex"],
      html: ""
    },
    {
      naam: "lengte",
      label: "Lengte",
      type: "double",
      isBasisVeld: true,
      constante: undefined,
      template: undefined,
      uniekeWaarden: ["10", "20", "30", "1"],
      html: ""
    },
    {
      naam: "gesloten",
      label: "Gesloten",
      type: "boolean",
      isBasisVeld: true,
      constante: undefined,
      template: undefined,
      uniekeWaarden: ["true", "false"],
      html: ""
    }
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

  geselecteerdeFeatures: Array<ol.Feature> = [];

  fietspadsegmentenSelectie: FietspadSelectie[] = [];
  geselecteerdeFietspadsegmenten: Array<ol.Feature> = [];

  precacheProgress = 0;
  laatsteCacheRefresh = "";
  precacheWMSWkt = wkts.districten.gent;
  precacheWMSInput: PrecacheWMS = null;

  precacheFeaturesWkt = wkts.gemeenten.brasschaat;
  precacheFeaturesInput: PrecacheFeatures = null;

  isOffline = false;

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
    rotatie: { value: true, label: "Kaart roteren (alt+shift+drag op desktop)" },
    // --- Linkerpaneel
    optieDivider2: { divider: true, value: true, label: "Opties linker paneel" },
    zoeker: { value: true, label: "Zoeker" },
    lagenkiezer: { value: true, label: "Lagen" },
    lagenVerwijderbaar: { value: true, label: "Lagen verwijderbaar" },
    legende: { value: true, label: "Legende (enkel in combinatie met lagen)" },
    kaartLinksFixedHeader: { value: false, label: "Custom vaste header in linker paneel" },
    kaartLinksExtraElements: { value: false, label: "Custom extra elementen in linker paneel" },
    kaartLinksBreedte: { value: false, label: "Custom breedte van 300px (default: 480px bij > 1240px en 360px bij <= 1240px)" },
    onderdrukKaartBevragenBoodschappen: { value: false, label: "Onderdruk kaart bevragen boodschappenpaneel" },

    // --- Widgets
    optieDivider3: { divider: true, value: true, label: "Widgets onderaan rechts" },
    achtergrond: { value: true, label: "Meerdere achtergrondlagen" },
    streetview: { value: true, label: "Streetview" },
    meten: { value: true, label: "Meten" },
    mijnlocatie: { value: true, label: "Mijn huidige locatie" },
    zoomknoppen: { value: true, label: "Zoomknoppen" },

    // --- Meten opties
    optieDivider3a: { divider: true, value: true, label: "Meten opties (teken modus op en afzetten na veranderingen)" },
    metenToon: { value: true, label: "Toon infopaneel" },
    metRouting: { value: false, label: "Verbinding via weg staat standaard aan" },
    keuzemogelijkheidTonen: { value: true, label: "Laat keuze tussen 'rechte lijn'/'via de weg' toe" },

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

  readonly fietspadStyle: ol.StyleFunction = validateAwvV0RuleDefintion(this.fietspadStijlDef).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  readonly afgeleideSnelheidsRegimesStyle: ol.StyleFunction = validateAwvV0RuleDefintion(this.afgeleideSnelheidsRegimesStijlDef).getOrElse(
    msg => {
      throw new Error(`slecht formaat ${msg}`);
    }
  );

  // resolutions: [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125],
  // minZoom 9 = resolutions[9] => 2.0
  readonly elisaVerkeersbordenStyle = definitieToStyleFunction(
    "json",
    JSON.stringify({
      version: "awv-v0",
      definition: {
        rules: [
          {
            condition: {
              kind: "<=",
              left: { kind: "Environment", type: "number", ref: "resolution" },
              right: { kind: "Literal", value: 2.0 }
            },
            style: {
              definition: {
                circle: {
                  radius: 5,
                  fill: {
                    color: "rgb(144, 202, 249)"
                  }
                }
              }
            }
          }
        ]
      }
    })
  ).getOrElseL(msg => {
    throw new Error(`slecht formaat ${join(msg)}`);
  });

  readonly elisaVerkeersbordenSelectedStyle = definitieToStyleFunction(
    "json",
    JSON.stringify({
      version: "awv-v0",
      definition: {
        rules: [
          {
            condition: {
              kind: "<=",
              left: { kind: "Environment", type: "number", ref: "resolution" },
              right: { kind: "Literal", value: 2.0 }
            },
            style: {
              definition: {
                circle: {
                  radius: 5,
                  fill: {
                    color: "rgb(255, 0, 0)"
                  },
                  stroke: {
                    color: "rgba(255, 0, 0, 0.15)",
                    width: 100
                  }
                }
              }
            }
          }
        ]
      }
    })
  ).getOrElseL(msg => {
    throw new Error(`slecht formaat ${join(msg)}`);
  });

  readonly verkeersbordenStyleFunction = verkeersbordenStyleFunction(false);
  readonly verkeersbordenSelectieStyleFunction = verkeersbordenStyleFunction(true);

  readonly fietspadStyleMetOffset = offsetStyleFunction(this.fietspadStyle, "ident8", "zijderijbaan", 3, false);

  readonly fietspadSelectieStyleMetOffset = function(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
    const applySelectionColor = function(s: ol.style.Style): ol.style.Style {
      const selectionStyle = s.clone();
      selectionStyle.getStroke().setColor([0, 153, 255, 1]);
      return selectionStyle;
    };
    const offsetFunc = offsetStyleFunction(this!.fietspadStyle, "ident8", "zijderijbaan", 3, false);
    const style = offsetFunc(feature, resolution);
    if (style instanceof ol.style.Style) {
      return applySelectionColor(style);
    } else {
      return style ? style.map(s => applySelectionColor(s)) : [];
    }
  }.bind(this);

  readonly afgeleideSnelheidsregimesStyleMetOffset = offsetStyleFunction(
    this.afgeleideSnelheidsRegimesStyle,
    null,
    "zijderijbaan",
    4,
    true
  );

  readonly afgeleideSnelheidsregimesSelectieStyleMetOffset = function(
    feature: ol.Feature,
    resolution: number
  ): ol.style.Style | ol.style.Style[] {
    const applySelectionColor = function(s: ol.style.Style): ol.style.Style {
      const selectionStyle = s.clone();
      selectionStyle.getStroke().setColor([0, 153, 255, 1]);
      return selectionStyle;
    };
    const offsetFunc = offsetStyleFunction(this!.afgeleideSnelheidsRegimesStyle, null, "zijderijbaan", 4, true);
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

  private cachedFeaturesProvider: Option<CachedFeatureLookup> = none;

  readonly cachedFeaturesProviderConsumer = (cfpc: CachedFeatureLookup) => (this.cachedFeaturesProvider = some(cfpc));

  startPrecacheWMS(start: string, eind: string, startMetLegeCache: boolean) {
    this.precacheWMSInput = {
      startZoom: Number(start),
      eindZoom: Number(eind),
      wkt: this.precacheWMSWkt,
      startMetLegeCache: startMetLegeCache
    };
  }

  startPrecacheFeatures(startMetLegeCache: boolean) {
    this.precacheFeaturesInput = {
      wkt: `SRID=31370;${this.precacheFeaturesWkt}`,
      startMetLegeCache: startMetLegeCache
    };
  }

  private addIcon() {
    if (this.installaties.length > 50) {
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
    setTimeout(() => this.addIcon(), 1000); // zorgt voor Angular Check event omdat setTimeout onderschept is door zone.js
  }

  polygoonGetekend(feature: ol.Feature) {
    this.polygoonEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  installatieGeselecteerd(feature: ol.Feature) {
    this.installatieGeselecteerdEvents.push(this.geoJsonFormatter.writeFeature(feature));
  }

  featuresGeselecteerd(event: Array<ol.Feature>) {
    // verwijder de bestaande info boodschappen voor features die niet meer geselecteerd zijn
    const nietLangerGeselecteerd = this.geselecteerdeFeatures //
      .filter(feature => !event.map(f => f.getId()).includes(feature.get("id")));
    nietLangerGeselecteerd.forEach(feature => this.selectieKaart.verbergIdentifyInformatie(feature.get("id").toString()));

    // voeg de nieuwe toe
    this.geselecteerdeFeatures = event;
    this.geselecteerdeFeatures.forEach(feature => this.selectieKaart.toonIdentifyInformatie(feature));
  }

  setOffline(offline: boolean) {
    this.isOffline = offline;
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

  toggleTekenen() {
    if (this.isTekenenActief()) {
      this.stopTekenen();
    } else {
      this.startTekenen();
    }
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
      return "10";
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
    // this.verplaatsKaart.dispatch(VerplaatsLaagCmd("dienstkaart-kleur", this.naarPositie, kaartLogOnlyWrapper));
  }

  stijlbareVectorlagen() {
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

  onZichtbareFeatures(features: Array<ol.Feature>): void {
    console.log("------> features", features);
  }

  onAchtergrondLagen(lagen: Array<ToegevoegdeLaag>): void {
    console.log("------> achtergrondlagen", lagen);
  }

  onVoorgrondHoogLagen(lagen: Array<ToegevoegdeLaag>): void {
    console.log("------> voorgrond hoog lagen", lagen);
  }

  onVoorgrondLaagLagen(lagen: Array<ToegevoegdeLaag>): void {
    console.log("------> voorgrond laag lagen", lagen);
  }

  onKaartLocaties(locaties: any): void {
    console.log("------> kaartLocaties", locaties);
  }

  onFietspadsegmentenZichtbaar(features: Array<ol.Feature>): void {
    this.fietspadsegmentenSelectie = features.map(feature => ({
      feature: feature,
      geselecteerd: false
    }));
    this.geselecteerdeFietspadsegmenten = [];
  }

  onFietspadsegmentGeselecteerd(selectie: FietspadSelectie, geselecteerd: boolean) {
    selectie.geselecteerd = geselecteerd;
    this.geselecteerdeFietspadsegmenten = this.fietspadsegmentenSelectie.filter(fss => fss.geselecteerd).map(fss => fss.feature);
  }

  onFietspadsegmentViaKaartSelectie(features: Array<ol.Feature>) {
    this.fietspadsegmentenSelectie.forEach(fss => (fss.geselecteerd = features.includes(fss.feature)));
    if (features.length !== this.geselecteerdeFietspadsegmenten.length) {
      this.geselecteerdeFietspadsegmenten = this.fietspadsegmentenSelectie.filter(fss => fss.geselecteerd).map(fss => fss.feature);
    }
  }

  onRefreshFietspadenClicked() {
    this.fietspadenRefreshSubj.next();
  }

  onPrecacheProgress(progress: number) {
    this.precacheProgress = progress;
    this.changeDetectorRef.detectChanges();
  }

  onLaatsteCacheRefresh(datum: Date) {
    this.laatsteCacheRefresh = datum.toLocaleString();
    this.changeDetectorRef.detectChanges();
  }

  scrollTo(idName: string): void {
    const element = document.getElementById(idName);
    element.scrollIntoView({ behavior: "smooth" });
  }

  onZetCenterManueel(coordTxt: string): void {
    forEach(parseCoordinate(coordTxt), (coords: [number, number]) => (this.configuratorMiddelpunt = coords));
  }

  onAlleFeatures(): void {
    interface Counter {
      count: number;
      last?: ol.Feature;
    }
    console.log("Alle features opvragen");
    forEach(this.cachedFeaturesProvider, provider =>
      provider
        .all$()
        .pipe(reduce<ol.Feature, Counter>((acc, feature) => ({ count: acc.count + 1, last: feature }), { count: 0, last: undefined }))
        .subscribe({
          next: ({ count, last }) => {
            console.log(`Aantal cached features gezien: ${count}`);
            console.log(`Laatste cached feature`, last);
          },
          complete: () => console.log("Opvragen klaar")
        })
    );
  }

  onAlleFeaturesInExtent(minX: string, minY: string, maxX: string, maxY: string): void {
    interface Counter {
      count: number;
      last?: ol.Feature;
    }
    try {
      const extent: ol.Extent = [minX, minY, maxX, maxY].map(txt => Number.parseFloat(txt)) as ol.Extent;
      console.log(`Alle features in extent ${extent} opvragen`);
      forEach(this.cachedFeaturesProvider, provider =>
        provider
          .inExtent$(extent)
          .pipe(reduce<ol.Feature, Counter>((acc, feature) => ({ count: acc.count + 1, last: feature }), { count: 0, last: undefined }))
          .subscribe({
            next: ({ count, last }) => {
              console.log(`Aantal cached features gezien: ${count}`);
              console.log(`Laatste cached feature`, last);
            },
            complete: () => console.log("Opvragen klaar")
          })
      );
    } catch (e) {
      console.warn("Waren dat wel nummers?", e);
    }
  }

  onFeatureById(id: string): void {
    console.log("Features by id opvragen", id);
    forEach(this.cachedFeaturesProvider, provider =>
      provider.byIds$([id]).subscribe({
        next: feature => {
          console.log(`Cached feature`, feature);
        },
        complete: () => console.log("Opvragen klaar")
      })
    );
  }

  onFeaturesByIdent8(ident8: string): void {
    console.log("Features by ident8 opvragen", ident8);
    forEach(this.cachedFeaturesProvider, provider =>
      provider
        .filtered$(f => f.getProperties() && f.getProperties().properties && f.getProperties().properties.ident8 === ident8)
        .subscribe({
          next: feature => {
            console.log(`Cached feature`, feature);
          },
          complete: () => console.log("Opvragen klaar")
        })
    );
  }
}
