import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule } from "@angular/material";
import { ClickOutsideModule } from "ng4-click-outside";
import * as ol from "openlayers";

import { ClassicAchtergrondSelectorComponent } from "../classic/achtergrond-selector/classic-achtergrond-selector.component";
import { ClassicCopyrightComponent } from "../classic/copyright/classic-copyright.component";
import { KaartClassicComponent } from "../classic/kaart-classic.component";
import { ClassicBlancoLaagComponent } from "../classic/lagen/classic-blanco-laag.component";
import { ClassicGeoserverLaagComponent } from "../classic/lagen/classic-geoserver-laag.component";
import { ClassicNosqlfsLaagComponent } from "../classic/lagen/classic-nosqlfs-laag.component";
import { ClassicOrthoLaagComponent } from "../classic/lagen/classic-ortho-laag.component";
import { ClassicTilecacheLaagComponent } from "../classic/lagen/classic-tilecache-laag.component";
import { ClassicVectorLaagComponent } from "../classic/lagen/classic-vector-laag.component";
import { ClassicWmsLaagComponent } from "../classic/lagen/classic-wms-laag.component";
import { ClassicWmtsLaagComponent } from "../classic/lagen/classic-wmts-laag.component";
import { ClassicLagenkiezerComponent } from "../classic/lagenkiezer/classic-lagenkiezer.component";
import { KaartOpenLayersStyleComponent } from "../classic/openlayers-style/classic-openlayers-style.component";
import { ClassicSchaalComponent } from "../classic/schaal/classic-schaal.component";
import { ClassicStandaardInteractiesComponent } from "../classic/standaard-interacties/classic-standaard-interacties.component";
import { ClassicVolledigSchermComponent } from "../classic/volledig-scherm/classic-volledig-scherm.component";
import { ClassicVoorwaardenComponent } from "../classic/voorwaarden/classic-voorwaarden.component";
import { LagenkiezerModule } from "../lagenkiezer/index";
import { ZoekerModule } from "../zoeker/index";

import { KaartAchtergrondSelectorComponent } from "./achtergrond-selector/kaart-achtergrond-selector.component";
import { KaartAchtergrondTileComponent } from "./achtergrond-selector/kaart-achtergrond-tile.component";
import { KaartCopyrightComponent } from "./copyright/kaart-copyright.component";
import { KaartInfoBoodschapAlertComponent } from "./info-boodschappen/kaart-info-boodschap-alert.component";
import { KaartInfoBoodschapIdentifyComponent } from "./info-boodschappen/kaart-info-boodschap-identify.component";
import { KaartInfoBoodschapComponent } from "./info-boodschappen/kaart-info-boodschap.component";
import { KaartInfoBoodschappenComponent } from "./info-boodschappen/kaart-info-boodschappen.component";
import { KAART_CFG, KaartConfig } from "./kaart-config";
import { ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import { KaartTekenLaagComponent } from "./kaart-teken-laag.component";
import { KaartTekenPolygoonLaagComponent } from "./kaart-teken-polygoon-laag.component";
import { KaartTekenComponent } from "./kaart-teken.component";
import { KaartFeaturesLaagComponent } from "./kaart-toon-features.component";
import { KaartComponent } from "./kaart.component";
import { KaartMijnLocatieComponent } from "./mijn-locatie/kaart-mijn-locatie.component";
import { KaartOpenStreetViewComponent } from "./open-street-view/kaart-open-street-view.component";
import { KaartSchaalComponent } from "./schaal/kaart-schaal.component";
import { KaartVoorwaardenComponent } from "./voorwaarden/kaart-voorwaarden.component";
import { KaartZoomComponent } from "./zoom/kaart-zoom.component";

const components: any[] = [
  ClassicSchaalComponent,
  ClassicVoorwaardenComponent,
  ClassicCopyrightComponent,
  ClassicLagenkiezerComponent,
  KaartComponent,
  ClassicAchtergrondSelectorComponent,
  KaartClassicComponent,
  ClassicVolledigSchermComponent,
  ClassicOrthoLaagComponent,
  KaartZoomComponent,
  KaartMijnLocatieComponent,
  ClassicStandaardInteractiesComponent,
  KaartTekenPolygoonLaagComponent,
  KaartTekenLaagComponent,
  KaartTekenComponent,
  KaartFeaturesLaagComponent,
  ClassicVectorLaagComponent,
  ClassicNosqlfsLaagComponent,
  KaartCopyrightComponent,
  KaartOpenLayersStyleComponent,
  KaartSchaalComponent,
  KaartVoorwaardenComponent,
  KaartCopyrightComponent,
  ClassicTilecacheLaagComponent,
  ClassicGeoserverLaagComponent,
  ClassicWmsLaagComponent,
  ClassicWmtsLaagComponent,
  ClassicBlancoLaagComponent,
  KaartAchtergrondSelectorComponent,
  KaartAchtergrondTileComponent,
  KaartOpenStreetViewComponent,
  KaartInfoBoodschappenComponent,
  KaartInfoBoodschapComponent,
  KaartInfoBoodschapIdentifyComponent,
  KaartInfoBoodschapAlertComponent,
  KaartSchaalComponent
];

// Weersta de drang om deze variabele in een andere module te plaatsen, want dat geeft problemen met gebruik in AOT app.
export const defaultKaartConfig: KaartConfig = {
  geoserver: {
    urls: [
      "https://wms1.apps.mow.vlaanderen.be/geoserver/wms",
      "https://wms2.apps.mow.vlaanderen.be/geoserver/wms",
      "https://wms3.apps.mow.vlaanderen.be/geoserver/wms"
    ]
  },
  tilecache: {
    urls: [
      "https://wms1.apps.mow.vlaanderen.be/geowebcache/service/wms",
      "https://wms2.apps.mow.vlaanderen.be/geowebcache/service/wms",
      "https://wms3.apps.mow.vlaanderen.be/geowebcache/service/wms"
    ]
  },
  orthofotomozaiek: {
    naam: "Ortho",
    urls: ["http://geoservices.informatievlaanderen.be/raadpleegdiensten/omwrgbmrvl/wms"]
  },
  srs: "EPSG:31370",
  defaults: {
    zoom: 2,
    middelpunt: [130000, 193000],
    grootte: [undefined, 500],
    resolutions: [1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125],
    extent: [18000.0, 152999.75, 280144.0, 415143.75],
    style: (null as any) as ol.style.Style
  }
};

@NgModule({
  imports: [
    CommonModule,
    ClickOutsideModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatCardModule,
    HttpClientModule,
    ZoekerModule.forRoot({}),
    LagenkiezerModule.withDefaults()
  ],
  declarations: [components],
  exports: [components],
  providers: [ReplaySubjectKaartCmdDispatcher]
})
export class KaartModule {
  static defaultConfig = defaultKaartConfig;

  static forRoot(config: KaartConfig): ModuleWithProviders {
    return {
      ngModule: KaartModule,
      providers: [{ provide: KAART_CFG, useValue: config }, ReplaySubjectKaartCmdDispatcher, KaartClassicComponent]
    };
  }

  static withDefaults(): ModuleWithProviders {
    return KaartModule.forRoot(KaartModule.defaultConfig);
  }
}

export * from "../classic/index";
export * from "./coordinaten.service";
export * from "../classic/kaart-classic.component";
export * from "./kaart-component-base";
export * from "./copyright/kaart-copyright.component";
export * from "../classic/openlayers-style/classic-openlayers-style.component";
export * from "./voorwaarden/kaart-voorwaarden.component";
export * from "./copyright/kaart-copyright.component";
export * from "../classic/volledig-scherm/classic-volledig-scherm.component";
export * from "../classic/lagen/classic-laag.component";
export * from "./schaal/kaart-schaal.component";
export * from "../classic/standaard-interacties/classic-standaard-interacties.component";
export * from "./kaart-teken-laag.component";
export * from "./kaart-teken-polygoon-laag.component";
export * from "./kaart-toon-features.component";
export * from "../classic/lagen/classic-vector-laag.component";
export * from "../classic/lagen/classic-nosqlfs-laag.component";
export * from "../classic/lagen/classic-geoserver-laag.component";
export * from "../classic/lagen/classic-tilecache-laag.component";
export * from "../classic/lagen/classic-wms-laag.component";
export * from "../classic/lagen/classic-wmts-laag.component";
export * from "../classic/lagen/classic-blanco-laag.component";
export * from "./zoom/kaart-zoom.component";
export * from "./mijn-locatie/kaart-mijn-locatie.component";
export * from "./open-street-view/kaart-open-street-view.component";
export * from "./kaart.component";
export * from "./kaart-event-dispatcher";
export * from "./kaart-protocol";
export * from "./kaart-elementen";
export * from "./stijl-selector";
export * from "./log";
export * from "./styles";
