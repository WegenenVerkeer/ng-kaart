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
import { KaartConfig, KAART_CFG } from "./kaart.config";
import { KaartWdbLaagComponent } from "./kaart-wdb-laag.component";
import { KaartOrthoLaagComponent } from "./kaart-ortho-laag.component";
import { CoordinatenService } from "./coordinaten.service";
import { KaartStandaardInteractiesComponent } from "./kaart-standaard-interacties.component";
import { KaartStandaardKnoppenComponent } from "./kaart-standaard-knoppen.component";
import { KaartAchtergrondSelectorComponent } from "./kaart-achtergrond-selector.component";
import { KaartAchtergrondTileComponent } from "./kaart-achtergrond-tile.component";
import { ReplaySubjectKaartEventDispatcher } from "./kaart-event-dispatcher";

const components: any[] = [
  KaartComponent,
  KaartClassicComponent,
  KaartKnopAchtergrondLaagKiezerComponent,
  KaartKnopVolledigSchermComponent,
  KaartKnopZoomSliderComponent,
  KaartOrthoLaagComponent,
  KaartSchaalComponent,
  KaartStandaardInteractiesComponent,
  KaartStandaardKnoppenComponent,
  KaartTekenPolygoonLaagComponent,
  KaartFeaturesLaagComponent,
  KaartVectorLaagComponent,
  KaartNosqlfsLaagComponent,
  KaartWdbLaagComponent,
  KaartWmsLaagComponent,
  KaartBlancoLaagComponent,
  KaartAchtergrondSelectorComponent,
  KaartAchtergrondTileComponent
];

@NgModule({
  imports: [CommonModule, ClickOutsideModule],
  declarations: [components],
  exports: [components],
  providers: [CoordinatenService, ReplaySubjectKaartEventDispatcher]
})
export class KaartModule {
  static defaultConfig: KaartConfig = {
    wdb: {
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
      grootte: [undefined, 500]
    }
  };

  static forRoot(config: KaartConfig): ModuleWithProviders {
    return {
      ngModule: KaartModule,
      providers: [{ provide: KAART_CFG, useValue: config }, ReplaySubjectKaartEventDispatcher, KaartClassicComponent]
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
export * from "./kaart-wdb-laag.component";
export * from "./kaart-wms-laag.component";
export * from "./kaart-blanco-laag.component";
export * from "./kaart.component";
export * from "./kaart-event-dispatcher";
export * from "./kaart-protocol";
export * from "./kaart-elementen";
export * from "./log";
