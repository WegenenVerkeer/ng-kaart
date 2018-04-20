import * as ol from "openlayers";

import { ModuleWithProviders, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ClickOutsideModule } from "ng4-click-outside";
import { KaartComponent } from "./kaart.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartKnopZoomSliderComponent } from "./kaart-knop-zoom-slider.component";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";
import { KaartNosqlfsLaagComponent } from "./kaart-nosqlfs-laag.component";
import { KaartBlancoLaagComponent } from "./kaart-blanco-laag.component";
import { KaartKnopAchtergrondLaagKiezerComponent } from "./kaart-knop-achtergrondlaag-kiezer.component";
import { KaartTekenPolygoonLaagComponent } from "./kaart-teken-polygoon-laag.component";
import { KaartFeaturesLaagComponent } from "./kaart-toon-features.component";
import { KaartKnopVolledigSchermComponent } from "./kaart-knop-volledig-scherm.component";
import { KaartSchaalComponent } from "./kaart-schaal.component";
import { KaartZoomComponent } from "./kaart-zoom.component";
import { KaartMijnLocatieComponent } from "./kaart-mijn-locatie.component";
import { KaartConfig, KAART_CFG } from "./kaart-config";
import { KaartTilecacheLaagComponent } from "./kaart-tilecache-laag.component";
import { KaartGeoserverLaagComponent } from "./kaart-geoserver-laag.component";
import { KaartOrthoLaagComponent } from "./kaart-ortho-laag.component";
import { CoordinatenService } from "./coordinaten.service";
import { KaartStandaardInteractiesComponent } from "./kaart-standaard-interacties.component";
import { KaartStandaardKnoppenComponent } from "./kaart-standaard-knoppen.component";
import { KaartAchtergrondSelectorComponent } from "./kaart-achtergrond-selector.component";
import { KaartAchtergrondTileComponent } from "./kaart-achtergrond-tile.component";
import { ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import { MatButtonModule, MatIconModule } from "@angular/material";
import { KaartWmtsLaagComponent } from "./kaart-wmts-laag.component";
import { ZoekerModule } from "../zoeker/index";
import { GoogleLocatieZoekerConfig } from "../zoeker/google-locatie-zoeker.config";

const components: any[] = [
  KaartComponent,
  KaartKnopAchtergrondLaagKiezerComponent,
  KaartClassicComponent,
  KaartKnopVolledigSchermComponent,
  KaartKnopZoomSliderComponent,
  KaartOrthoLaagComponent,
  KaartSchaalComponent,
  KaartZoomComponent,
  KaartMijnLocatieComponent,
  KaartStandaardInteractiesComponent,
  KaartStandaardKnoppenComponent,
  KaartTekenPolygoonLaagComponent,
  KaartFeaturesLaagComponent,
  KaartVectorLaagComponent,
  KaartNosqlfsLaagComponent,
  KaartTilecacheLaagComponent,
  KaartGeoserverLaagComponent,
  KaartWmsLaagComponent,
  KaartWmtsLaagComponent,
  KaartBlancoLaagComponent,
  KaartAchtergrondSelectorComponent,
  KaartAchtergrondTileComponent
];

// Weersta de drang om deze 2 variabelen in een andere module te plaatsen, want dat geeft problemen met gebruik in AOT app.
const stdStijl = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "#5555FF40"
  }),
  stroke: new ol.style.Stroke({
    color: "darkslateblue ",
    width: 4
  }),
  image: new ol.style.Circle({
    fill: new ol.style.Fill({
      color: "maroon"
    }),
    stroke: new ol.style.Stroke({
      color: "gray",
      width: 1.25
    }),
    radius: 5
  })
});

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
  imports: [CommonModule, ClickOutsideModule, MatButtonModule, MatIconModule, ZoekerModule.forRoot({})],
  declarations: [components],
  exports: [components],
  providers: [CoordinatenService, ReplaySubjectKaartCmdDispatcher]
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

export * from "./coordinaten.service";
export * from "./kaart-classic.component";
export * from "./kaart-component-base";
export * from "./kaart-knop-achtergrondlaag-kiezer.component";
export * from "./kaart-knop-volledig-scherm.component";
export * from "./kaart-knop-zoom-slider.component";
export * from "./kaart-laag.component";
export * from "./kaart-schaal.component";
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
export * from "./kaart.component";
export * from "./kaart-event-dispatcher";
export * from "./kaart-protocol";
export * from "./kaart-elementen";
export * from "./log";
