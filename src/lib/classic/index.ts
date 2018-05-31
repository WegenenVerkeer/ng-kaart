import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { KaartModule } from "../kaart/index";

import { ClassicAchtergrondSelectorComponent } from "./achtergrond-selector/classic-achtergrond-selector.component";
import { ClassicCopyrightComponent } from "./copyright/classic-copyright.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { ClassicBlancoLaagComponent } from "./lagen/classic-blanco-laag.component";
import { ClassicFeaturesLaagComponent } from "./lagen/classic-features-laag.component";
import { ClassicGeoserverLaagComponent } from "./lagen/classic-geoserver-laag.component";
import { ClassicNosqlfsLaagComponent } from "./lagen/classic-nosqlfs-laag.component";
import { ClassicOrthoLaagComponent } from "./lagen/classic-ortho-laag.component";
import { ClassicTilecacheLaagComponent } from "./lagen/classic-tilecache-laag.component";
import { ClassicVectorLaagComponent } from "./lagen/classic-vector-laag.component";
import { ClassicWmsLaagComponent } from "./lagen/classic-wms-laag.component";
import { ClassicWmtsLaagComponent } from "./lagen/classic-wmts-laag.component";
import { ClassicLagenkiezerComponent } from "./lagenkiezer/classic-lagenkiezer.component";
import { ClassicLegendeBolletjeItemComponent } from "./legende/classic-legende-bolletje-item.component";
import { ClassicLegendeLijnItemComponent } from "./legende/classic-legende-lijn-item.component";
import { ClassicLegendePolygoonItemComponent } from "./legende/classic-legende-polygoon-item.component";
import { ClassicSchaalComponent } from "./schaal/classic-schaal.component";
import { ClassicStandaardInteractiesComponent } from "./standaard-interacties/classic-standaard-interacties.component";
import { ClassicVolledigSchermComponent } from "./volledig-scherm/classic-volledig-scherm.component";
import { ClassicVoorwaardenComponent } from "./voorwaarden/classic-voorwaarden.component";

const components = [
  ClassicSchaalComponent,
  ClassicVoorwaardenComponent,
  ClassicCopyrightComponent,
  ClassicLagenkiezerComponent,
  ClassicAchtergrondSelectorComponent,
  ClassicVolledigSchermComponent,
  ClassicOrthoLaagComponent,
  ClassicStandaardInteractiesComponent,
  ClassicFeaturesLaagComponent,
  ClassicVectorLaagComponent,
  ClassicNosqlfsLaagComponent,
  ClassicTilecacheLaagComponent,
  ClassicGeoserverLaagComponent,
  ClassicWmsLaagComponent,
  ClassicWmtsLaagComponent,
  ClassicBlancoLaagComponent,
  ClassicLegendeLijnItemComponent,
  ClassicLegendeBolletjeItemComponent,
  ClassicLegendePolygoonItemComponent,
  KaartClassicComponent
];

@NgModule({
  imports: [CommonModule, KaartModule],
  declarations: [components],
  exports: [components],
  providers: [KaartClassicComponent]
})
export class ClassicModule {}

export * from "./achtergrond-selector/classic-achtergrond-selector.component";
export * from "./common/classic-ui-element-selector-component-base";
export * from "./copyright/classic-copyright.component";
export * from "./kaart-classic.component";
export * from "./lagen/classic-blanco-laag.component";
export * from "./lagen/classic-features-laag.component";
export * from "./lagen/classic-geoserver-laag.component";
export * from "./lagen/classic-laag.component";
export * from "./lagen/classic-nosqlfs-laag.component";
export * from "./lagen/classic-ortho-laag.component";
export * from "./lagen/classic-tilecache-laag.component";
export * from "./lagen/classic-vector-laag.component";
export * from "./lagen/classic-wms-laag.component";
export * from "./lagen/classic-wmts-laag.component";
export * from "./lagenkiezer/classic-lagenkiezer.component";
export * from "./log";
export * from "./openlayers-style/classic-openlayers-style.component";
export * from "./schaal/classic-schaal.component";
export * from "./standaard-interacties/classic-standaard-interacties.component";
export * from "./volledig-scherm/classic-volledig-scherm.component";
export * from "./voorwaarden/classic-voorwaarden.component";
