import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectorRef, Component, NgZone, ViewChild, ViewEncapsulation } from "@angular/core";
import { array } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { CachedFeatureLookup } from "projects/ng-kaart/src/lib/kaart/cache/lookup";
import * as ol from "projects/ng-kaart/src/lib/util/openlayers-compat";
import { urlWithParams } from "projects/ng-kaart/src/lib/util/url";
import * as rx from "rxjs";
import { map, reduce, scan, share, shareReplay, startWith, throttleTime } from "rxjs/operators";

import {
  AwvV0DynamicStyle,
  AwvV0StaticStyleSpec,
  ClassicLaagKlikInfoEnStatus,
  defaultMarkerStyle,
  definitieToStyle,
  definitieToStyleFunction,
  forEach,
  join,
  KaartClassicComponent,
  offsetStyleFunction,
  parseCoordinate,
  PrecacheFeatures,
  PrecacheWMS,
  SelectieModus,
  ToegevoegdeLaag,
  validateAwvV0RuleDefintion,
  VeldInfo,
  Veldwaarde,
  verkeersbordenStyleFunction,
  zoekerMetPrioriteiten,
  ZoekerMetWeergaveopties
} from "../../projects/ng-kaart/src/public_api";

import { DummyZoeker } from "./dummy-zoeker";
import { LocatieServices2Service, WegsegmentEnLocatie } from "./locatieservices2.service";
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
        animate("0.2s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 1, "max-height": "1000px" }))
      ]),
      transition(":leave", [
        style({ opacity: 1, "max-height": "1000px" }),
        animate("0.15s cubic-bezier(.62,.28,.23,.99)", style({ opacity: 0, "max-height": 0 }))
      ])
    ])
  ],
  encapsulation: ViewEncapsulation.None
})
export class FeatureDemoComponent {
  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly locatieservices2Service: LocatieServices2Service
  ) {
    this.addIcon();
  }

  private static readonly zoekerKleurCodes = ["#626c7a", "#6b7d43", "#f8df98", "#e38d83", "#6e312f"];
  @ViewChild("verplaats")
  private verplaatsKaart: KaartClassicComponent;
  @ViewChild("selectie")
  private selectieKaart: KaartClassicComponent;
  @ViewChild("kaartInfoKaart")
  private kaartInfoKaart: KaartClassicComponent;

  zoekAfstandWegen = 100;
  wegLocatie$: rx.Observable<WegsegmentEnLocatie> = rx.empty();
  wegen$: rx.Observable<WegsegmentEnLocatie[]> = rx.empty();
  genummerdeWegen$: rx.Observable<WegsegmentEnLocatie[]> = rx.empty();
  nietGenummerdeWegen$: rx.Observable<WegsegmentEnLocatie[]> = rx.empty();
  enkelGenummerdeWegen = false;
  enkelRelatievePosities = false;

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

  readonly featuresToCluster: ol.Feature[] = this.generateFeaturesToCluster();

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
  mechelenCentrum: ol.Coordinate = [157562, 190726];
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
      anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
      anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
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

  pinIconSelect = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
      anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
      scale: 1,
      opacity: 1,
      src: require("material-design-icons/maps/svg/production/ic_place_48px.svg")
    }),
    text: new ol.style.Text({
      font: "12px 'Helvetica Neue', sans-serif",
      fill: new ol.style.Fill({ color: "#000" }),
      offsetY: -60,
      stroke: new ol.style.Stroke({
        color: "#f88",
        width: 2
      }),
      text: "Selected"
    })
  });

  pinIcon2 = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 1],
      anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
      anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
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

  meetpuntStyle = new ol.style.Style({
    image: new ol.style.Circle({
      fill: new ol.style.Fill({
        color: "green"
      }),
      radius: 5
    })
  });

  geselecteerdeFeatures: ol.Feature[] = [];

  fietspadsegmentenSelectie: FietspadSelectie[] = [];
  geselecteerdeFietspadsegmenten: ol.Feature[] = [];

  precacheProgress = 0;
  laatsteCacheRefresh = "";
  precacheWMSWkt = wkts.districten.gent;
  precacheWMSInput?: PrecacheWMS = undefined;

  precacheFeaturesWkt = wkts.gemeenten.brasschaat;
  precacheFeaturesInput?: PrecacheFeatures = undefined;

  isOffline = false;

  tekenenActief = false;
  geometryType = "Polygon";
  private getekendeGeom: Option<ol.geom.Geometry> = none;

  private alleVoorwaarden = ["Voorwaarden disclaimer", "Er zijn nieuwe voorwaarden", "Er zijn nog nieuwere voorwaarden"];
  voorwaarden = this.alleVoorwaarden[0];
  private voorwaardenIndex = 0;

  huidigeZoom = -1;
  minZoom = 2;
  maxZoom = 5;

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

    // --- Identify
    optieDivider3b: { divider: true, value: true, label: "Identify opties" },
    markeerLocatie: { value: true, label: "Toon kliklocatie" },
    customKlikIcon: { value: true, label: "Gecustomiseerd icoon" },

    // --- Kaartinfo
    optieDivider4: { divider: true, value: true, label: "Kaartinfo onderaan rechts" },
    schaal: { value: true, label: "Kaartschaal" },
    voorwaarden: { value: true, label: "Voorwaarden disclaimer" },
    copyright: { value: true, label: "Copyright boodschap" },

    // -- progressbar dingen
    optieDivider5: { divider: true, value: true, label: "Laden opties" },
    forceProgressBar: { value: false, label: "Activeer progressbar" },
    progressbar: { value: false, label: "Progressbar zichtbaar" }
  };

  configuratorMiddelpunt = [130000, 193000];

  readonly districtStyle: ol.style.Style = definitieToStyle(
    "json",
    '{"version": "awv-v0", "definition": {"stroke": {"color": "rgba(0,127,255,0.8)", "width": 1.5}}}'
  ).getOrElseL(msg => {
    throw new Error(`slecht formaat ${join(",")(msg)}`);
  });

  readonly bordStyle: ol.style.Style = definitieToStyle(
    "json",
    // tslint:disable-next-line:max-line-length
    '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "#7D3C98", "width": 1.5}, "fill": {"color": "#D7BDE2"}, "radius": 6}}}'
  ).getOrElseL(msg => {
    throw new Error(`slecht formaat ${join(",")(msg)}`);
  });

  readonly kolkStyle: ol.style.Style = definitieToStyle(
    "json",
    // tslint:disable-next-line:max-line-length
    '{"version": "awv-v0", "definition": {"circle": {"stroke": {"color": "navy", "width": 1.5}, "fill": {"color": "dodgerblue"}, "radius": 6}}}'
  ).getOrElseL(msg => {
    throw new Error(`slecht formaat ${join(",")(msg)}`);
  });

  readonly fietspadStyle: ol.style.StyleFunction = validateAwvV0RuleDefintion(this.fietspadStijlDef).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

  readonly afgeleideSnelheidsRegimesStyle: ol.style.StyleFunction = validateAwvV0RuleDefintion(
    this.afgeleideSnelheidsRegimesStijlDef
  ).getOrElse(msg => {
    throw new Error(`slecht formaat ${msg}`);
  });

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
    throw new Error(`slecht formaat ${join(",")(msg)}`);
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
    throw new Error(`slecht formaat ${join(",")(msg)}`);
  });

  readonly verkeersbordenStyleFunction = verkeersbordenStyleFunction(false);
  readonly verkeersbordenSelectieStyleFunction = verkeersbordenStyleFunction(true);

  readonly fietspadStyleMetOffset = offsetStyleFunction(this.fietspadStyle, "ident8", "zijderijbaan", 3, false);
  readonly fietspadStyleMetOffset2 = offsetStyleFunction(this.fietspadStyle, "ident8", "zijderijbaan", 6, false);

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

  readonly fietspadSelectieStyleMetOffset2 = function(feature: ol.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
    const applySelectionColor = function(s: ol.style.Style): ol.style.Style {
      const selectionStyle = s.clone();
      selectionStyle.getStroke().setColor([0, 153, 255, 1]);
      return selectionStyle;
    };
    const offsetFunc = offsetStyleFunction(this!.fietspadStyle, "ident8", "zijderijbaan", 6, false);
    const style = offsetFunc(feature, resolution);
    if (style instanceof ol.style.Style) {
      return applySelectionColor(style);
    } else {
      return style ? style.map(s => applySelectionColor(s)) : [];
    }
  }.bind(this);

  readonly afgeleideSnelheidsregimesStyleMetOffset = offsetStyleFunction(this.afgeleideSnelheidsRegimesStyle, "", "zijderijbaan", 4, true);

  readonly afgeleideSnelheidsregimesSelectieStyleMetOffset = function(
    feature: ol.Feature,
    resolution: number
  ): ol.style.Style | ol.style.Style[] {
    const applySelectionColor = function(s: ol.style.Style): ol.style.Style {
      const selectionStyle = s.clone();
      selectionStyle.getStroke().setColor([0, 153, 255, 1]);
      return selectionStyle;
    };
    const offsetFunc = offsetStyleFunction(this!.afgeleideSnelheidsRegimesStyle, "", "zijderijbaan", 4, true);
    const style = offsetFunc(feature, resolution);
    if (style instanceof ol.style.Style) {
      return applySelectionColor(style);
    } else {
      return style ? style.map(s => applySelectionColor(s)) : [];
    }
  }.bind(this);

  readonly fietspadenRefreshSubj = new rx.Subject<void>();
  readonly fietspadenRefresh$ = this.fietspadenRefreshSubj.asObservable();

  readonly demoZoekers: ZoekerMetWeergaveopties[] = [
    zoekerMetPrioriteiten(new DummyZoeker("dummy0", FeatureDemoComponent.zoekerKleurCodes[0]), 1, 1, true, true),
    zoekerMetPrioriteiten(new DummyZoeker("dummy1", FeatureDemoComponent.zoekerKleurCodes[1]), 2, 2, true, true)
  ];

  private cachedFeaturesProvider: Option<CachedFeatureLookup> = none;

  offlineGeselecteerdeFeatures: ol.Feature[] = [];

  readonly snelheidsregimesVeldinfos: VeldInfo[] = [
    {
      isBasisVeld: false,
      label: "ID",
      naam: "id",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Wegsegment ID",
      naam: "wegsegmentId",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "ID vorige wegsegment",
      naam: "vorigeWegsegmentId",
      type: "string"
    },
    {
      isBasisVeld: true,
      label: "Bepalende bord",
      naam: "bepalendBordCode",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Gescheiden rijbaan geen autostrade?",
      naam: "gescheidenrijbaan",
      type: "boolean"
    },
    {
      isBasisVeld: false,
      label: "Wegcategorie autosnelweg?",
      naam: "autosnelweg",
      type: "boolean"
    },
    {
      isBasisVeld: false,
      label: "Zone",
      naam: "zones",
      type: "string"
    },
    {
      isBasisVeld: true,
      label: "Ident8",
      naam: "ident8",
      type: "string"
    },
    {
      isBasisVeld: true,
      label: "Snelheid",
      naam: "snelheid",
      type: "integer"
    }
  ];

  readonly referentiepuntenVeldinfos: VeldInfo[] = [
    {
      isBasisVeld: false,
      label: "ID",
      naam: "id",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Ident8",
      naam: "locatie.ident8",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Opschrift",
      naam: "locatie.opschrift",
      type: "double"
    },
    {
      isBasisVeld: true,
      label: "Positie",
      naam: "locatie.positie",
      type: "double"
    },
    {
      isBasisVeld: false,
      label: "Opnamedatum",
      naam: "opnamedatum",
      sqlFormat: "DD/MM/YYYY",
      type: "date"
    },
    {
      isBasisVeld: false,
      label: "Wijzigingsdatum",
      naam: "wijzigingsdatum",
      sqlFormat: "DD/MM/YYYY",
      type: "date"
    },
    {
      isBasisVeld: false,
      label: "Materiaal",
      naam: "materiaalpaal.naam",
      type: "string",
      uniekeWaarden: []
    },
    {
      isBasisVeld: true,
      label: "Geldig beide richtingen",
      naam: "geldigBeideRichtingen",
      type: "boolean"
    },
    {
      isBasisVeld: false,
      label: "Opmerking",
      naam: "opmerking",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Begindatum",
      naam: "begindatum",
      sqlFormat: "DD/MM/YYYY",
      type: "date"
    },
    {
      isBasisVeld: false,
      label: "Creatiedatum",
      naam: "creatiedatum",
      sqlFormat: "DD/MM/YYYY",
      type: "date"
    },
    {
      isBasisVeld: false,
      label: "Gebruiker",
      naam: "gebruiker",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Gebied",
      naam: "gebied",
      type: "string",
      uniekeWaarden: []
    },
    {
      isBasisVeld: false,
      label: "Bebouwde kom",
      naam: "bebouwdekom",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Wegcategorie",
      naam: "wegcategorie",
      type: "string",
      uniekeWaarden: []
    }
  ];

  readonly kunstwerkenVeldinfos: VeldInfo[] = [
    {
      isBasisVeld: false,
      label: "UIDN",
      naam: "UIDN",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "OIDN",
      naam: "OIDN",
      type: "string"
    },
    {
      isBasisVeld: true,
      label: "Type",
      naam: "LBLTYPE",
      type: "string",
      uniekeWaarden: []
    },
    {
      isBasisVeld: true,
      label: "Vorm",
      naam: "LBLVORM",
      type: "string",
      uniekeWaarden: []
    },
    {
      isBasisVeld: false,
      label: "Lengte (m)",
      naam: "LENGTE",
      type: "double"
    },
    {
      isBasisVeld: false,
      label: "Opname datum",
      naam: "OPNDATUM",
      type: "string"
    },
    {
      isBasisVeld: false,
      label: "Oppervlakte (m^2)",
      naam: "OPPERVL",
      type: "double"
    }
  ];

  readonly fietspadenVeldinfos: VeldInfo[] = [
    { isBasisVeld: false, label: "ID", naam: "id", type: "string" },
    { isBasisVeld: true, label: "Ident8", naam: "ident8", type: "string" },
    { isBasisVeld: true, label: "Van refpunt", naam: "locatie.begin.opschrift", type: "double" },
    { isBasisVeld: true, label: "Van afst", naam: "locatie.begin.afstand", type: "integer" },
    { isBasisVeld: true, label: "Van positie", naam: "locatie.begin.positie", type: "double" },
    { isBasisVeld: true, label: "Tot refpunt", naam: "locatie.eind.opschrift", type: "double" },
    { isBasisVeld: true, label: "Tot afst", naam: "locatie.eind.afstand", type: "integer" },
    { isBasisVeld: true, label: "Tot Positie", naam: "locatie.eind.positie", type: "double" },
    { isBasisVeld: true, label: "Lengte", naam: "locatie.lengte", type: "double", displayFormat: "1.0-0" }, // custom formaat
    { isBasisVeld: false, label: "Werkelijke lengte", naam: "werkelijkelengte", type: "double" },
    { isBasisVeld: false, label: "Bron Id", naam: "bronid", type: "string" },
    { isBasisVeld: false, label: "Opnamedatum", naam: "opnamedatum", type: "date", parseFormat: "dd/LL/yyyy", sqlFormat: "dd/MM/yyyy" },
    { isBasisVeld: false, label: "Wijzigingsdatum", naam: "wijzigingsdatum", type: "date" }, // standaard sqlFormat
    { isBasisVeld: true, label: "Zijde", naam: "zijderijbaan", type: "string", uniekeWaarden: ["R", "L", "M", "NVT"] }, // niet alfabetisch!
    {
      isBasisVeld: true,
      label: "Type",
      naam: "typefietspad",
      type: "string",
      uniekeWaarden: [
        "",
        "AANLIGGEND",
        "Aanliggend",
        "Aanliggend Verhoogd",
        "Geen Fietspad",
        "VRIJLIGGEND",
        "Vrijliggend",
        "aanliggend",
        "vrijliggend"
      ]
    },
    { isBasisVeld: false, label: "Verhoogd", naam: "verhoogd", type: "boolean" },
    { isBasisVeld: true, label: "Afst rijbaan", naam: "afstandrijbaan", type: "string" },
    { isBasisVeld: true, label: "Breedte", naam: "breedte", type: "integer" },
    {
      isBasisVeld: true,
      label: "Hoofdverharding",
      naam: "wegverharding_1",
      type: "string",
      uniekeWaarden: ["Andere en onbekend", "Asfalt", "Bestrating", "Beton", "Dunne Toplaag", "Ongebonden"]
    },
    {
      isBasisVeld: false,
      label: "Subverharding",
      naam: "wegverharding_2",
      type: "string",
      uniekeWaarden: [
        "--Ongekend--",
        "Andere",
        "Antisliplaag",
        "Asfaltbeton",
        "Bestrijking",
        "Betonstraatstenen",
        "Betontegels",
        "Dolomietverharding",
        "Doorgaand gewapend platenbeton",
        "Gebakken straatstenen",
        "Gekleurd platenbeton",
        "Gemengd",
        "Gietasfalt",
        "Grijs platenbeton",
        "Keien",
        "Mozaikkeien",
        "Onbekend",
        "Spitmastiekasfalt",
        "Steenslag",
        "Zeer open asfalt"
      ]
    },
    { isBasisVeld: false, label: "Kleur", naam: "kleur", type: "string", uniekeWaarden: ["Andere", "NVT", "Rood"] },
    { isBasisVeld: true, label: "Dubbelrichting", naam: "dubbelerichting", type: "boolean" },
    { isBasisVeld: false, label: "Gemarkeerd", naam: "gemarkeerd", type: "boolean" },
    {
      isBasisVeld: false,
      label: "Tussenstrook",
      naam: "tussenstrook",
      type: "string",
      uniekeWaarden: ["--Onbekend--", "Geen", "NVT", "Type 1", "Type 2", "Type 3"]
    },
    { isBasisVeld: false, label: "Opmerking", naam: "opmerking", type: "string" },
    { isBasisVeld: false, label: "Begindatum", naam: "begindatum", type: "date" },
    { isBasisVeld: false, label: "Creatiedatum", naam: "creatiedatum", type: "date" },
    { isBasisVeld: false, label: "Gebied", naam: "gebied", type: "string" },
    { isBasisVeld: false, label: "Bebouwde kom", naam: "bebouwdekom", type: "string" },
    { isBasisVeld: false, label: "Wegcategorie", naam: "wegcategorie", type: "string" },
    { isBasisVeld: false, label: "Gebruiker", naam: "gebruiker", type: "string" }
  ];

  readonly staatVanDeWegVeldInfos: VeldInfo[] = [
    { isBasisVeld: false, label: "ID", naam: "id", type: "string" },
    { isBasisVeld: true, label: "Ident8", naam: "ident8", type: "string" },
    { isBasisVeld: true, label: "Van refpunt", naam: "locatie.begin.opschrift", type: "double" },
    { isBasisVeld: true, label: "Van afst", naam: "locatie.begin.afstand", type: "integer" },
    { isBasisVeld: true, label: "Van positie", naam: "locatie.begin.positie", type: "double" },
    { isBasisVeld: true, label: "Tot refpunt", naam: "locatie.eind.opschrift", type: "double" },
    { isBasisVeld: true, label: "Tot afst", naam: "locatie.eind.afstand", type: "integer" },
    { isBasisVeld: true, label: "Tot Positie", naam: "locatie.eind.positie", type: "double" },
    { isBasisVeld: true, label: "Lengte", naam: "locatie.lengte", type: "double", displayFormat: "1.0-0" }, // custom formaat
    { isBasisVeld: false, label: "Werkelijke lengte", naam: "werkelijkelengte", type: "double" },
    { isBasisVeld: false, label: "Bron Id", naam: "bronid", type: "string" },
    { isBasisVeld: false, label: "Globale Index", naam: "globale_index.globaleIndex", type: "integer" }
  ];

  readonly verkeersbordenVeldinfos: VeldInfo[] = [
    { isBasisVeld: false, label: "ID", naam: "id", type: "integer" },
    { isBasisVeld: true, label: "Ident8", naam: "ident8", type: "string" },
    { isBasisVeld: true, label: "Refpunt", naam: "opschrift", type: "double" },
    { isBasisVeld: true, label: "Afstand", naam: "afstand", type: "integer" },
    { isBasisVeld: true, label: "Zijde van de rijweg", naam: "zijdeVanDeRijweg", type: "string" },
    { isBasisVeld: true, label: "Langs gewestweg", naam: "langsGewestweg", type: "boolean" },
    { isBasisVeld: false, label: "Gebied", naam: "gebied", type: "string" },
    { isBasisVeld: false, label: "UUID", naam: "uuid", type: "string" },
    { isBasisVeld: true, label: "Status", naam: "status", type: "string" },
    { isBasisVeld: false, label: "Wijzigingsdatum", naam: "wijzigingsdatum", type: "date", sqlFormat: "DD/MM/YYYY" }
  ];

  readonly bordenVeldinfos: VeldInfo[] = [
    { isBasisVeld: false, label: "Locatie X", naam: "geometry.location.0", type: "double" },
    { isBasisVeld: false, label: "Locatie Y", naam: "geometry.location.1", type: "double" },
    { isBasisVeld: true, label: "Type bord", naam: "code", type: "string" },
    { isBasisVeld: true, label: "Breedte", naam: "breedte", type: "double", isGeenLocatieVeld: true },
    { isBasisVeld: true, label: "Hoogte", naam: "hoogte", type: "double" }
  ];

  readonly percelenVeldinfos: VeldInfo[] = [
    { isBasisVeld: true, label: "Id", naam: "OBJECTID", type: "integer" },
    { isBasisVeld: true, label: "Capakey", naam: "CAPAKEY", type: "string" },
    { isBasisVeld: true, label: "Perceel", naam: "PERCID", type: "string" },
    { isBasisVeld: true, label: "Jaar", naam: "JAAR", type: "integer" },
    { isBasisVeld: true, label: "NIS code", naam: "NIS_CODE", type: "string" },
    { isBasisVeld: true, label: "Gewest", naam: "LIGGING_GEWEST", type: "string" },
    { isBasisVeld: true, label: "Gemeente", naam: "LIGGING_GEMEENTE", type: "string" },
    { isBasisVeld: true, label: "Beheerder", naam: "BEHEERDER_NAAM_KORT", type: "string" },
    { isBasisVeld: false, label: "Beheerder (lang)", naam: "BEHEERDER_NAAM_LANG", type: "string" },
    { isBasisVeld: true, label: "Eigenaar", naam: "EIGENAAR_NAAM_KORT", type: "string" },
    { isBasisVeld: false, label: "Eigenaar (lang)", naam: "EIGENAAR_NAAM_LANG", type: "string" },
    { isBasisVeld: true, label: "Eigenaar KBO nr", naam: "EIGENAAR_KBONR", type: "string" },
    { isBasisVeld: true, label: "Perceel categorie", naam: "PERCEEL_CATEGORIE", type: "string" },
    { isBasisVeld: true, label: "Kadaster oppervlakte (m²)", naam: "KADASTER_OPPERVLAKTE_M2", type: "double" },
    { isBasisVeld: true, label: "Cadmap oppervlakte (m²)", naam: "CADMAP_OPPERVLAKTE_M2", type: "double" },
    { isBasisVeld: true, label: "Grb oppervlakte (m²)", naam: "GRB_OPPERVLAKTE_M2", type: "double" },
    { isBasisVeld: true, label: "Opgemeten oppervlakte (m²)", naam: "OPGEMETEN_OPPERVLAKTE_M2", type: "double" },
    { isBasisVeld: true, label: "Rbh code", naam: "RBH_CODE", type: "string" },
    { isBasisVeld: false, label: "Rbh code (lang)", naam: "RBH_CODE_DESCR", type: "string" },
    { isBasisVeld: true, label: "Percentage eigenaar", naam: "PERCENTAGE_EIGENAAR", type: "string" },
    { isBasisVeld: true, label: "Kadastrale aard ", naam: "KADASTRALE_AARD_CODE", type: "string" },
    { isBasisVeld: false, label: "Kadastrale aard (lang)", naam: "KADASTRALE_AARD_DESCR", type: "string" },
    { isBasisVeld: true, label: "Kadastraal recht", naam: "KADASTRAAL_RECHT_CODE", type: "string" },
    { isBasisVeld: false, label: "Kadastraal recht (lang)", naam: "KADASTRAAL_RECHT_DESCR", type: "string" },
    { isBasisVeld: true, label: "Data beheerder vsgd", naam: "DATA_BEHEERDER_VSGD", type: "string" },
    { isBasisVeld: true, label: "Bebouwde oppervlakte", naam: "BEBOUWDE_OPPERVLAKTE", type: "double" },
    { isBasisVeld: true, label: "Bron geometrie", naam: "BRON_GEOMETRIE", type: "string" },
    { isBasisVeld: true, label: "Bestemming symb", naam: "BESTEMMING_SYMB", type: "string" },
    { isBasisVeld: true, label: "Percentage bebouwd", naam: "PERCENTAGE_BEBOUWD", type: "double" },
    { isBasisVeld: true, label: "Bebouwd", naam: "BEBOUWD", type: "boolean" },
    { isBasisVeld: false, label: "Shape length", naam: "SHAPE_Length", type: "double" },
    { isBasisVeld: false, label: "Shape area", naam: "SHAPE_Area", type: "double" }
  ];

  readonly wfsStratenVeldinfos: VeldInfo[] = [
    { isBasisVeld: true, label: "ID", naam: "id", type: "string" },
    { isBasisVeld: true, label: "Straatnaam", naam: "name", type: "string" },
    { isBasisVeld: true, label: "Lengte", naam: "meters", type: "double" }
  ];

  readonly innamesVeldinfos: VeldInfo[] = [
    {
      isBasisVeld: true,
      label: "Vanaf",
      naam: "vandatum",
      type: "date",
      parseFormat: "yyyy-LL-dd'T'hh:mm:ss",
      displayFormat: "dd/LL/yyyy hh:mm"
    },
    {
      isBasisVeld: true,
      label: "Tot",
      naam: "totdatum",
      type: "date",
      parseFormat: "yyyy-LL-dd'T'hh:mm:ss",
      displayFormat: "dd/LL/yyyy hh:mm"
    },
    {
      isBasisVeld: true,
      label: "Gewijzigd",
      naam: "gewijzigd_op",
      type: "date",
      parseFormat: "yyyy-LL-dd'T'hh:mm:ss",
      displayFormat: "dd/LL/yyyy hh:mm"
    }
  ];

  private readonly featureSelectieModusSubj: rx.Subject<SelectieModus> = new rx.Subject();
  readonly featureSelectieModus$: rx.Observable<SelectieModus> = this.featureSelectieModusSubj.asObservable();

  readonly schopStijlSpec: AwvV0StaticStyleSpec = {
    type: "StaticStyle",
    definition: {
      icon: {
        anchor: [0.5, 1],
        anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
        anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
        scale: 1,
        opacity: 1,
        src:
          // tslint:disable-next-line: max-line-length
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAAlQTFRFAAAA//QA////2q2SgwAAAAF0Uk5TAEDm2GYAAAABYktHRAJmC3xkAAAALklEQVQY02NgYGAQDWGAAAEWKENEBMpgDYAxHKAMxkHPCA0lgQH3O5wB9zLYQAAL0AqM5iwu/gAAAABJRU5ErkJggg=="
      }
    }
  };

  readonly schop = JSON.stringify(this.schopStijlSpec);

  // Deze specificatie is JSON die ook geserialiseerd als string kan doorgegeven worden
  readonly sterSpec: AwvV0StaticStyleSpec = {
    type: "StaticStyle",
    definition: {
      icon: {
        anchor: [0.5, 0.5],
        anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
        anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
        scale: 1,
        opacity: 1,
        src: require("src/assets/images/icon.svg")
      }
    }
  };

  // Dit is een arbitraire OL stijl.
  readonly ster = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 0.5],
      anchorXUnits: ol.style.IconAnchorUnits.FRACTION,
      anchorYUnits: ol.style.IconAnchorUnits.FRACTION,
      scale: 1,
      opacity: 1,
      src: require("src/assets/images/icon.svg")
    })
  });

  // Dit is een arbitraire OL stijl. Toevallig gelijk aan de standaard.
  readonly standaardIcoon = defaultMarkerStyle;

  readonly featureLoopSelectie$ = new rx.Subject<ol.Feature[]>();

  readonly mechelenZichtbaarToggleSubj: rx.Subject<null> = new rx.Subject();
  readonly mechelenZichtbaar$ = this.mechelenZichtbaarToggleSubj.pipe(
    scan<null, boolean>(prev => !prev, true),
    startWith(true)
  );

  readonly mechelenSelecteerbaarToggleSubj: rx.Subject<null> = new rx.Subject();
  readonly mechelenSelecteerbaar$ = this.mechelenSelecteerbaarToggleSubj.pipe(
    scan<null, boolean>(prev => !prev, true),
    startWith(true)
  );

  readonly cachedFeaturesProviderConsumer = (cfpc: CachedFeatureLookup) => (this.cachedFeaturesProvider = some(cfpc));

  readonly percelenQueryUrl: Function1<ol.Coordinate, string> = location => {
    const params = {
      service: "WMS",
      request: "GetFeatureInfo",
      version: "1.1.0",
      srs: "EPSG:31370",
      info_format: "text/plain",
      layers: "Percelen_Vlaamse_overheid_2014_bron_Cadmap",
      query_layers: "Percelen_Vlaamse_overheid_2014_bron_Cadmap",
      height: 2,
      width: 2,
      x: 0,
      y: 0,
      bbox: `${location[0] - 1},${location[1] - 1},${location[0] + 1},${location[1] + 1}`,
      bron: "Bestuurszaken Percelen"
    };
    return urlWithParams("/geoloket2/rest/externewms/featureInfo", params);
    // const corsProxy = "http://localhost:9090/"; // TODO iets dat altijd bereikbaar is
    // const targetServer = "http://bzgis.vlaanderen.be/ArcGIS/services/DBZ/Vastgoed_Percelen_Vlaamse_overheid/MapServer/WMSServer";
    // return `${corsProxy}${targetServer}?${encodeParams(params)}`;
    // tslint:disable-next-line:semicolon
  };

  readonly percelenWmsParser: Function1<string, Veldwaarde[]> = resp => {
    // Dit is maar een vb van een parser
    // vb:
    // tslint:disable-next-line:max-line-length
    // @Percelen_Vlaamse_overheid_2014_bron_Cadmap OBJECTID;SHAPE;CAPAKEY;PERCID;JAAR;NIS_CODE;LIGGING_GEWEST;LIGGING_GEMEENTE;BEHEERDER_NAAM_KORT;BEHEERDER_NAAM_LANG;EIGENAAR_NAAM_KORT;EIGENAAR_NAAM_LANG;EIGENAAR_KBONR;PERCEEL_CATEGORIE;KADASTER_OPPERVLAKTE_M2;CADMAP_OPPERVLAKTE_M2;GRB_OPPERVLAKTE_M2;OPGEMETEN_OPPERVLAKTE_M2;RBH_CODE;RBH_CODE_DESCR;PERCENTAGE_EIGENAAR;KADASTRALE_AARD_CODE;KADASTRALE_AARD_DESC;KADASTRAAL_RECHT_DESC;DATA_BEHEERDER_VSGD;BEBOUWD;BEBOUWDE_OPPERVLAKTE;PERCENTAGE_BEBOUWD;BRON_GEOMETRIE;BESTEMMING_SYMB;SHAPE_Length;SHAPE_Area; 74708;Polygon;11008H0257/00T000;11008_H_0257_T_000_00;2014;11008;Vlaams Gewest;BRASSCHAAT;VMM;Vlaamse Milieumaatschappij;VMM;Vlaamse Milieumaatschappij;0887.290.276;LANDBOUWGROND;24381;25557.89;25522.27;Null;06;landschappelijk waardevolle agrarische gebieden;100;KANAAL;kanaal;volle eigendom;Departement Informatie Vlaanderen;Nee;Null;Null;CADMAP;Landbouw;1714.918603;25557.887197;

    const numHeaders = 32; // Ik vind geen manier om dat af te leiden in het algemeen

    // Eerst verwijderen we de naam van de WMS
    const withoutWMSName = resp.replace(/@\w+\s/, "");
    // Ik ga er van uit dat de headers geen ; bevatten
    const fragments = withoutWMSName.split(";");
    const headerNames = array.take(numHeaders, fragments);
    const header = headerNames.join(";");
    const valueLine = withoutWMSName.substring(header.length + 1, withoutWMSName.length);
    const values = valueLine.split(/;(?! )/); // sommige waarden bevatten ;, maar dan staat er hopelijk een spatie achter
    // Een "echte" parser moet ook de datatypes juist zetten
    return array.zip(headerNames, values);
    // tslint:disable-next-line:semicolon
  };

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

  featuresGeselecteerd(event: ol.Feature[], selectieKaart: KaartClassicComponent) {
    console.log("Features geselecteerd", event);
  }

  busy(event: any) {
    console.log("busy via de classic component attribuut: ", event);
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
      return "";
    }
  }

  getKaartLinksBreedte(): number {
    if (this.mogelijkeOpties["kaartLinksBreedte"].value) {
      return 300;
    } else {
      return 0;
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

  transparantieaanpasbareLagen(titel: string) {
    return true; // we zouden kunnen beperken tot WMS lagen door naar het titel argument te kijken
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

  onKaartClick(clickCoordinaat: any): void {
    console.log("------> kaartClick", clickCoordinaat);
  }

  onMijnMobieleLocatieStateChange(stateChange: any): void {
    console.log("-----> stateChange", stateChange);
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
    forEach(fromNullable(element), elt => elt.scrollIntoView({ behavior: "smooth" }));
  }

  onZetCenterManueel(coordTxt: string): void {
    forEach(parseCoordinate(coordTxt), (coords: [number, number]) => (this.configuratorMiddelpunt = coords));
  }

  onAlleFeatures(): void {
    console.log("Alle features opvragen");
    forEach(this.cachedFeaturesProvider, provider => this.verwerkSelectie(provider.all$()));
  }

  onAlleFeaturesInExtent(minX: string, minY: string, maxX: string, maxY: string): void {
    try {
      const extent: ol.Extent = [minX, minY, maxX, maxY].map(txt => Number.parseFloat(txt)) as ol.Extent;
      console.log(`Alle features in extent ${extent} opvragen`);
      forEach(this.cachedFeaturesProvider, provider => this.verwerkSelectie(provider.inExtent$(extent)));
    } catch (e) {
      console.warn("Waren dat wel nummers?", e);
    }
  }

  onFeatureById(id: string): void {
    console.log("Features by id opvragen", id);
    forEach(this.cachedFeaturesProvider, provider => this.verwerkSelectie(provider.byIds$([id])));
  }

  onFeaturesByIdent8(ident8: string): void {
    console.log("Features by ident8 opvragen", ident8);
    forEach(this.cachedFeaturesProvider, provider =>
      this.verwerkSelectie(
        provider.filtered$(f => f.getProperties() && f.getProperties().properties && f.getProperties().properties.ident8 === ident8)
      )
    );
  }

  private verwerkSelectie(feature$: rx.Observable<ol.Feature>): void {
    interface Counter {
      count: number;
      last?: ol.Feature;
    }
    const sharedFeature$ = feature$.pipe(share());
    sharedFeature$
      .pipe(reduce<ol.Feature, Counter>((acc, feature) => ({ count: acc.count + 1, last: feature }), { count: 0, last: undefined }))
      .subscribe({
        next: ({ count, last }) => {
          console.log(`Aantal cached features gezien: ${count}`);
          console.log(`Laatste cached feature`, last);
        },
        complete: () => console.log("Opvragen klaar")
      });
    sharedFeature$
      .pipe(
        scan<ol.Feature, ol.Feature[]>(array.snoc, []),
        throttleTime(500, undefined, { leading: true, trailing: true })
      )
      .subscribe(features => {
        this.offlineGeselecteerdeFeatures = features;
      });
  }

  voegZoekerToe(toonIcoon: boolean, toonOppervlak: boolean) {
    const index = this.demoZoekers.length;
    this.demoZoekers.push(
      zoekerMetPrioriteiten(
        new DummyZoeker(`Dummy${index}`, FeatureDemoComponent.zoekerKleurCodes[index % FeatureDemoComponent.zoekerKleurCodes.length]),
        index,
        index,
        toonIcoon,
        toonOppervlak
      )
    );
  }

  verwijderZoeker() {
    this.demoZoekers.pop();
  }

  onFeatureSelectie(features: ol.Feature[]) {
    console.log("---> Geselecteerde features", features);
    // Dit is zoals Elisa werkt. Hier om een regressie te testen/voorkomen.
    setTimeout(() => {
      this.geselecteerdeFeatures = features;
    }, 500);
  }

  onClickSelecteerFeatures() {
    this.geselecteerdeFeatures = [...this.mechelenFeatures];
  }

  generateFeaturesToCluster(): ol.Feature[] {
    let id = 0;
    const pointFeature = (c: ol.Coordinate) =>
      new ol.Feature({
        id: id++,
        geometry: new ol.geom.Point(c)
      });
    const offset = (r: number) => (c: ol.Coordinate) =>
      [c[0] + (Math.random() * 2 * r - r), c[1] + (Math.random() * 2 * r - r)] as ol.Coordinate;
    const features: ol.Feature[] = [];
    const radius1 = 20000; // 20 km
    const radius2 = 2000; // 2 km
    for (let c = 0; c < 5; ++c) {
      const center = offset(radius1)([157562, 190726]);
      for (let i = 0; i < Math.random() * 30 + 20; ++i) {
        features.push(pointFeature(offset(radius2)(center)));
      }
    }
    return features;
  }

  onFeatureSelectionOff() {
    this.featureSelectieModusSubj.next("none");
  }

  onFeatureSelectionSingle() {
    this.featureSelectieModusSubj.next("single");
  }

  onFeatureSelectionMulti() {
    this.featureSelectieModusSubj.next("multipleKlik");
  }

  onFeatureLoopSelectie(features: ol.Feature[]) {
    console.log("****Feature in loop", features);
    this.featureLoopSelectie$.next(features);
  }

  onToggleZichtbaar() {
    this.mechelenZichtbaarToggleSubj.next();
  }

  onToggleSelecteerbaar() {
    this.mechelenSelecteerbaarToggleSubj.next();
  }

  onSetMinZoom(value: number) {
    this.minZoom = value;
  }

  onSetMaxZoom(value: number) {
    this.maxZoom = value;
  }

  onZoomEvent(value: number) {
    this.huidigeZoom = value;
  }

  onPercelenBevragen(info: ClassicLaagKlikInfoEnStatus) {
    console.log("***Percelen info:", info);
  }

  onWegLocatieClick(coordinate: ol.Coordinate) {
    this.wegLocatie$ = this.locatieservices2Service.zoekOpWegLocatie(coordinate);
  }

  onWegenClick(coordinate: ol.Coordinate) {
    this.wegen$ = this.locatieservices2Service.zoekOpWegen(coordinate, this.zoekAfstandWegen).pipe(shareReplay(1));
    this.genummerdeWegen$ = this.wegen$.pipe(map(locaties => locaties.filter(locatie => locatie.locatie.relatief)));
    this.nietGenummerdeWegen$ = this.wegen$.pipe(map(locaties => locaties.filter(locatie => !locatie.locatie.relatief)));
  }
}
