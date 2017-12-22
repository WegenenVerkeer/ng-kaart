import { ModuleWithProviders, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { KaartComponent } from "./kaart.component";
import { KaartKnopZoomSliderComponent } from "./kaart-knop-zoom-slider.component";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";
import { KaartKnopLaagKiezerComponent } from "./kaart-knop-laag-kiezer.component";
import { KaartTekenPolygoonLaagComponent } from "./kaart-teken-polygoon-laag.component";
import { KaartToonFeaturesComponent } from "./kaart-toon-features.component";
import { KaartKnopVolledigSchermComponent } from "./kaart-knop-volledig-scherm.component";
import { KaartSchaalComponent } from "./kaart-schaal.component";
import { KaartConfig } from "./kaart.config";
import { KaartWdbLaagComponent } from "./kaart-wdb-laag.component";
import { KaartOrthoLaagComponent } from "./kaart-ortho-laag.component";
import { CoordinatenService } from "./coordinaten.service";
import { KaartStandaardInteractiesComponent } from "./kaart-standaard-interacties.component";
import { KaartStandaardKnoppenComponent } from "./kaart-standaard-knoppen.component";

const components: any[] = [
  KaartComponent,
  KaartKnopLaagKiezerComponent,
  KaartKnopVolledigSchermComponent,
  KaartKnopZoomSliderComponent,
  KaartOrthoLaagComponent,
  KaartSchaalComponent,
  KaartStandaardInteractiesComponent,
  KaartStandaardKnoppenComponent,
  KaartTekenPolygoonLaagComponent,
  KaartToonFeaturesComponent,
  KaartVectorLaagComponent,
  KaartWdbLaagComponent,
  KaartWmsLaagComponent
];

@NgModule({
  imports: [CommonModule],
  declarations: [components],
  exports: [components],
  providers: [CoordinatenService]
})
export class KaartModule {
  static forRoot(config: KaartConfig): ModuleWithProviders {
    return {
      ngModule: KaartModule,
      providers: [{ provide: KaartConfig, useValue: config }]
    };
  }

  static withDefaults(): ModuleWithProviders {
    return KaartModule.forRoot({
      wdb: {
        urls: [
          "https://wms1.apps.mow.vlaanderen.be/geoserver/wms",
          "https://wms2.apps.mow.vlaanderen.be/geoserver/wms",
          "https://wms3.apps.mow.vlaanderen.be/geoserver/wms"
        ]
      },
      orthofotomozaiek: {
        urls: ["http://geoservices.informatievlaanderen.be/raadpleegdiensten/omwrgbmrvl/wms"]
      },
      srs: "EPSG:31370"
    });
  }
}

export * from "./coordinaten.service";
export * from "./kaart-component-base";
export * from "./kaart-knop-laag-kiezer.component";
export * from "./kaart-knop-volledig-scherm.component";
export * from "./kaart-knop-zoom-slider.component";
export * from "./kaart-laag.component";
export * from "./kaart-schaal.component";
export * from "./kaart-standaard-interacties.component";
export * from "./kaart-standaard-knoppen.component";
export * from "./kaart-teken-polygoon-laag.component";
export * from "./kaart-toon-features.component";
export * from "./kaart-vector-laag.component";
export * from "./kaart-wdb-laag.component";
export * from "./kaart-wms-laag.component";
export * from "./kaart.component";
