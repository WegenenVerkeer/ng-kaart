import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule } from "@angular/material";
import { ClickOutsideModule } from "ng4-click-outside";
import * as ol from "openlayers";

import { ClassicSchaalComponent } from "../classic/schaal/classic-schaal.component";
import { LagenkiezerModule } from "../lagenkiezer/index";
import { ZoekerModule } from "../zoeker/index";

import { KaartAchtergrondSelectorComponent } from "./kaart-achtergrond-selector.component";
import { KaartAchtergrondTileComponent } from "./kaart-achtergrond-tile.component";
import { KaartBlancoLaagComponent } from "./kaart-blanco-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KAART_CFG, KaartConfig } from "./kaart-config";
import { KaartCopyrightComponent } from "./kaart-copyright.component";
import { ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import { KaartGeoserverLaagComponent } from "./kaart-geoserver-laag.component";
import { KaartInfoBoodschapAlertComponent } from "./kaart-info-boodschap-alert.component";
import { KaartInfoBoodschapIdentifyComponent } from "./kaart-info-boodschap-identify.component";
import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";
import { KaartInfoBoodschappenComponent } from "./kaart-info-boodschappen.component";
import { KaartKnopAchtergrondLaagKiezerComponent } from "./kaart-knop-achtergrondlaag-kiezer.component";
import { KaartKnopVolledigSchermComponent } from "./kaart-knop-volledig-scherm.component";
import { KaartKnopZoomSliderComponent } from "./kaart-knop-zoom-slider.component";
import { KaartMijnLocatieComponent } from "./kaart-mijn-locatie.component";
import { KaartNosqlfsLaagComponent } from "./kaart-nosqlfs-laag.component";
import { KaartOpenStreetViewComponent } from "./kaart-open-street-view.component";
import { KaartOpenLayersStyleComponent } from "./kaart-openlayers.component";
import { KaartOrthoLaagComponent } from "./kaart-ortho-laag.component";
import { KaartStandaardInteractiesComponent } from "./kaart-standaard-interacties.component";
import { KaartStandaardKnoppenComponent } from "./kaart-standaard-knoppen.component";
import { KaartTekenLaagComponent } from "./kaart-teken-laag.component";
import { KaartTekenPolygoonLaagComponent } from "./kaart-teken-polygoon-laag.component";
import { KaartTekenComponent } from "./kaart-teken.component";
import { KaartTilecacheLaagComponent } from "./kaart-tilecache-laag.component";
import { KaartFeaturesLaagComponent } from "./kaart-toon-features.component";
import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";
import { KaartVoorwaardenBoxComponent } from "./kaart-voorwaarden-box.component";
import { KaartVoorwaardenComponent } from "./kaart-voorwaarden.component";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartWmtsLaagComponent } from "./kaart-wmts-laag.component";
import { KaartZoomComponent } from "./kaart-zoom.component";
import { KaartComponent } from "./kaart.component";
import { KaartSchaalComponent } from "./schaal/kaart-schaal.component";

const components: any[] = [
  ClassicSchaalComponent,
  KaartComponent,
  KaartKnopAchtergrondLaagKiezerComponent,
  KaartClassicComponent,
  KaartKnopVolledigSchermComponent,
  KaartKnopZoomSliderComponent,
  KaartOrthoLaagComponent,
  KaartZoomComponent,
  KaartMijnLocatieComponent,
  KaartStandaardInteractiesComponent,
  KaartStandaardKnoppenComponent,
  KaartTekenPolygoonLaagComponent,
  KaartTekenLaagComponent,
  KaartTekenComponent,
  KaartFeaturesLaagComponent,
  KaartVectorLaagComponent,
  KaartNosqlfsLaagComponent,
  KaartCopyrightComponent,
  KaartOpenLayersStyleComponent,
  KaartSchaalComponent,
  KaartVoorwaardenComponent,
  KaartVoorwaardenBoxComponent,
  KaartTilecacheLaagComponent,
  KaartGeoserverLaagComponent,
  KaartWmsLaagComponent,
  KaartWmtsLaagComponent,
  KaartBlancoLaagComponent,
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

export * from "../classic";
export * from "./coordinaten.service";
export * from "./kaart-classic.component";
export * from "./kaart-component-base";
export * from "./kaart-copyright.component";
export * from "./kaart-openlayers.component";
export * from "./kaart-voorwaarden.component";
export * from "./kaart-voorwaarden-box.component";
export * from "./kaart-knop-achtergrondlaag-kiezer.component";
export * from "./kaart-knop-volledig-scherm.component";
export * from "./kaart-knop-zoom-slider.component";
export * from "./kaart-laag.component";
export * from "./schaal/kaart-schaal.component";
export * from "./kaart-standaard-interacties.component";
export * from "./kaart-standaard-knoppen.component";
export * from "./kaart-teken-polygoon-laag.component";
export * from "./kaart-toon-features.component";
export * from "./kaart-vector-laag.component";
export * from "./kaart-nosqlfs-laag.component";
export * from "./kaart-geoserver-laag.component";
export * from "./kaart-tilecache-laag.component";
export * from "./kaart-wms-laag.component";
export * from "./kaart-wmts-laag.component";
export * from "./kaart-blanco-laag.component";
export * from "./kaart-zoom.component";
export * from "./kaart-mijn-locatie.component";
export * from "./kaart-open-street-view.component";
export * from "./kaart.component";
export * from "./kaart-event-dispatcher";
export * from "./kaart-protocol";
export * from "./kaart-elementen";
export * from "./log";
export * from "./styles";
