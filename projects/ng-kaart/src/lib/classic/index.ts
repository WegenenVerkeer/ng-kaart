import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { KaartModule } from "../kaart/index";

import { ClassicAchtergrondSelectorComponent } from "./achtergrond-selector/classic-achtergrond-selector.component";
import { ClassicCopyrightComponent } from "./copyright/classic-copyright.component";
import { ClassicFeatureTabelComponent } from "./feature-tabel/classic-feature-tabel";
import { ClassicKaartBevragenComponent } from "./kaart-bevragen/classic-kaart-bevragen.component";
import { ClassicKaartIdentifyComponent } from "./kaart-bevragen/classic-kaart-identify.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { ClassicKaartLadenComponent } from "./kaart-laden/classic-kaart-laden.component";
import { ClassicBlancoLaagComponent } from "./lagen/classic-blanco-laag.component";
import { ClassicFeaturesLaagComponent } from "./lagen/classic-features-laag.component";
import { ClassicGeoserverLaagComponent } from "./lagen/classic-geoserver-laag.component";
import { ClassicNosqlfsLaagComponent } from "./lagen/classic-nosqlfs-laag.component";
import { ClassicOrthoLaagComponent } from "./lagen/classic-ortho-laag.component";
import { ClassicTilecacheLaagComponent } from "./lagen/classic-tilecache-laag.component";
import { ClassicVectorLaagComponent } from "./lagen/classic-vector-laag.component";
import { ClassicWfsLaagComponent } from "./lagen/classic-wfs-laag.component";
import { ClassicWmsLaagComponent } from "./lagen/classic-wms-laag.component";
import { ClassicWmtsLaagComponent } from "./lagen/classic-wmts-laag.component";
import { ClassicLagenkiezerComponent } from "./lagenkiezer/classic-lagenkiezer.component";
import { ClassicLegendeBolletjeItemComponent } from "./legende/classic-legende-bolletje-item.component";
import { ClassicLegendeImageItemComponent } from "./legende/classic-legende-image-item.component";
import { ClassicLegendeLijnItemComponent } from "./legende/classic-legende-lijn-item.component";
import { ClassicLegendePolygoonItemComponent } from "./legende/classic-legende-polygoon-item.component";
import { ClassicMarkeerKaartklikComponent } from "./markeer-kaartklik/classic-markeer-kaartklik.component";
import { ClassicMetenComponent } from "./meten/classic-meet.component";
import { ClassicMultiMetenComponent } from "./meten/classic-multi-meet.component";
import { ClassicMijnLocatieComponent } from "./mijn-locatie/classic-mijn-locatie.component";
import { ClassicMijnMobieleLocatieComponent } from "./mijn-locatie/classic-mijn-mobiele-locatie.component";
import { ClassicSchaalComponent } from "./schaal/classic-schaal.component";
import { ClassicStandaardInteractiesComponent } from "./standaard-interacties/classic-standaard-interacties.component";
import { ClassicStreetviewComponent } from "./streetview/classic-streetview.component";
import { ClassicVolledigSchermComponent } from "./volledig-scherm/classic-volledig-scherm.component";
import { ClassicVoorwaardenComponent } from "./voorwaarden/classic-voorwaarden.component";
import { ClassicCrabZoekerComponent } from "./zoeker/classic-crab-zoeker.component";
import { ClassicGoogleZoekerComponent } from "./zoeker/classic-google-zoeker.component";
import { ClassicPerceelZoekerComponent } from "./zoeker/classic-perceel-zoeker.component";
import { ClassicZoekerComponent } from "./zoeker/classic-zoeker.component";
import { ClassicZoomComponent } from "./zoom/classic-zoom.component";

export const componentMap = {
  "awv-bevraag-kaart": ClassicKaartBevragenComponent,
  "awv-kaart-blanco-laag": ClassicBlancoLaagComponent,
  "awv-kaart-classic-dummy": KaartClassicComponent,
  "awv-kaart-copyright": ClassicCopyrightComponent,
  "awv-kaart-crab-zoeker": ClassicCrabZoekerComponent,
  "awv-kaart-features-laag": ClassicFeaturesLaagComponent,
  "awv-kaart-geoserver-laag": ClassicGeoserverLaagComponent,
  "awv-kaart-google-zoeker": ClassicGoogleZoekerComponent,
  "awv-kaart-identify": ClassicKaartIdentifyComponent,
  "awv-kaart-knop-achtergrondlaag-kiezer": ClassicAchtergrondSelectorComponent,
  "awv-kaart-knop-volledig-scherm": ClassicVolledigSchermComponent,
  "awv-kaart-laden": ClassicKaartLadenComponent,
  "awv-kaart-lagenkiezer": ClassicLagenkiezerComponent,
  "awv-kaart-markeer-kaartklik": ClassicMarkeerKaartklikComponent,
  "awv-kaart-mijn-locatie": ClassicMijnLocatieComponent,
  "awv-kaart-mijn-mobiele-locatie": ClassicMijnMobieleLocatieComponent,
  "awv-kaart-multi-meet-knop": ClassicMultiMetenComponent,
  "awv-kaart-nosqlfs-laag": ClassicNosqlfsLaagComponent,
  "awv-kaart-ortho-laag": ClassicOrthoLaagComponent,
  "awv-kaart-perceel-zoeker": ClassicPerceelZoekerComponent,
  "awv-kaart-schaal": ClassicSchaalComponent,
  "awv-kaart-standaard-interacties": ClassicStandaardInteractiesComponent,
  "awv-kaart-streetview": ClassicStreetviewComponent,
  "awv-kaart-tilecache-laag": ClassicTilecacheLaagComponent,
  "awv-kaart-vector-laag": ClassicVectorLaagComponent,
  "awv-kaart-voorwaarden": ClassicVoorwaardenComponent,
  "awv-kaart-wfs-laag": ClassicWfsLaagComponent,
  "awv-kaart-wms-laag": ClassicWmsLaagComponent,
  "awv-kaart-wmts-laag": ClassicWmtsLaagComponent,
  "awv-kaart-zoeker": ClassicZoekerComponent,
  "awv-kaart-zoomknoppen": ClassicZoomComponent,
  "awv-legende-bolletje-item": ClassicLegendeBolletjeItemComponent,
  "awv-legende-image-item": ClassicLegendeImageItemComponent,
  "awv-legende-lijn-item": ClassicLegendeLijnItemComponent,
  "awv-legende-polygoon-item": ClassicLegendePolygoonItemComponent,
  "awv-meet-knop": ClassicMetenComponent,
  "awv-feature-tabel": ClassicFeatureTabelComponent
};

const components = [
  ClassicAchtergrondSelectorComponent,
  ClassicBlancoLaagComponent,
  ClassicCopyrightComponent,
  ClassicCrabZoekerComponent,
  ClassicFeaturesLaagComponent,
  ClassicFeatureTabelComponent,
  ClassicGeoserverLaagComponent,
  ClassicGoogleZoekerComponent,
  ClassicKaartBevragenComponent,
  ClassicKaartIdentifyComponent,
  ClassicLagenkiezerComponent,
  ClassicLegendeBolletjeItemComponent,
  ClassicLegendeImageItemComponent,
  ClassicLegendeLijnItemComponent,
  ClassicLegendePolygoonItemComponent,
  ClassicMarkeerKaartklikComponent,
  ClassicMetenComponent,
  ClassicMijnLocatieComponent,
  ClassicMijnMobieleLocatieComponent,
  ClassicMultiMetenComponent,
  ClassicNosqlfsLaagComponent,
  ClassicOrthoLaagComponent,
  ClassicPerceelZoekerComponent,
  ClassicSchaalComponent,
  ClassicStandaardInteractiesComponent,
  ClassicStreetviewComponent,
  ClassicTilecacheLaagComponent,
  ClassicVectorLaagComponent,
  ClassicVolledigSchermComponent,
  ClassicVoorwaardenComponent,
  ClassicWfsLaagComponent,
  ClassicWmsLaagComponent,
  ClassicWmtsLaagComponent,
  ClassicZoekerComponent,
  ClassicZoomComponent,
  ClassicKaartLadenComponent,
  KaartClassicComponent
];

@NgModule({
  imports: [CommonModule, KaartModule],
  declarations: [components],
  exports: [components],
  entryComponents: [components]
})
export class ClassicModule {}

export * from "./achtergrond-selector/classic-achtergrond-selector.component";
export * from "./common/classic-ui-element-selector-component-base";
export * from "./copyright/classic-copyright.component";
export * from "./feature-tabel/classic-feature-tabel";
export * from "./kaart-classic.component";
export * from "./lagen/classic-blanco-laag.component";
export * from "./lagen/classic-features-laag.component";
export * from "./lagen/classic-geoserver-laag.component";
export * from "./lagen/classic-laag.component";
export * from "./lagen/classic-nosqlfs-laag.component";
export * from "./lagen/classic-ortho-laag.component";
export * from "./lagen/classic-tilecache-laag.component";
export * from "./lagen/classic-vector-laag.component";
export * from "./lagen/classic-wfs-laag.component";
export * from "./lagen/classic-wms-laag.component";
export * from "./lagen/classic-wmts-laag.component";
export * from "./lagenkiezer/classic-lagenkiezer.component";
export * from "./legende/classic-legende-bolletje-item.component";
export * from "./legende/classic-legende-image-item.component";
export * from "./legende/classic-legende-item.component";
export * from "./legende/classic-legende-lijn-item.component";
export * from "./legende/classic-legende-polygoon-item.component";
export * from "./log";
export * from "./markeer-kaartklik/classic-markeer-kaartklik.component";
export * from "./meten/classic-meet.component";
export * from "./mijn-locatie/classic-mijn-locatie.component";
export * from "./mijn-locatie/classic-mijn-mobiele-locatie.component";
export * from "./openlayers-style/classic-openlayers-style.component";
export * from "./schaal/classic-schaal.component";
export * from "./standaard-interacties/classic-standaard-interacties.component";
export * from "./streetview/classic-streetview.component";
export * from "./volledig-scherm/classic-volledig-scherm.component";
export * from "./voorwaarden/classic-voorwaarden.component";
export * from "./zoeker/classic-zoeker.component";
export * from "./kaart-laden/classic-kaart-laden.component";
export * from "./zoom/classic-zoom.component";
export * from "./kaart-bevragen/classic-kaart-bevragen.component";
export * from "./kaart-bevragen/classic-kaart-identify.component";
