import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ModuleWithProviders, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  MAT_TOOLTIP_DEFAULT_OPTIONS,
  MatButtonModule,
  MatButtonToggleModule,
  MatCardModule,
  MatExpansionModule,
  MatIconModule,
  MatInputModule,
  MatProgressSpinnerModule,
  MatTooltipDefaultOptions,
  MatTooltipModule
} from "@angular/material";
import { ClickOutsideModule } from "ng4-click-outside";
import * as ol from "openlayers";

import { AbbameldaModule } from "../abbamelda/index";
import { KaartOpenLayersStyleComponent } from "../classic/openlayers-style/classic-openlayers-style.component";
import { KaartTekenComponent } from "../classic/tekenen/kaart-teken.component";
import { FilterModule } from "../filter/index";
import { LagenkiezerModule } from "../lagenkiezer/index";
import { ZoekerModule } from "../zoeker/index";

import { KaartAchtergrondSelectorComponent } from "./achtergrond-selector/kaart-achtergrond-selector.component";
import { KaartAchtergrondTileComponent } from "./achtergrond-selector/kaart-achtergrond-tile.component";
import { KaartCopyrightComponent } from "./copyright/kaart-copyright.component";
import { KaartInfoBoodschapAlertComponent } from "./info-boodschappen/kaart-info-boodschap-alert.component";
import { KaartInfoBoodschapIdentifyComponent } from "./info-boodschappen/kaart-info-boodschap-identify.component";
import { KaartInfoBoodschapKaartBevragenComponent } from "./info-boodschappen/kaart-info-boodschap-kaart-bevragen.component";
import { KaartInfoBoodschapMetenComponent } from "./info-boodschappen/kaart-info-boodschap-meten.component";
import { KaartInfoBoodschapVeldinfoComponent } from "./info-boodschappen/kaart-info-boodschap-veldinfo.component";
import { KaartInfoBoodschapComponent } from "./info-boodschappen/kaart-info-boodschap.component";
import { KaartInfoBoodschappenComponent } from "./info-boodschappen/kaart-info-boodschappen.component";
import { KaartBevragenComponent } from "./kaart-bevragen/kaart-bevragen.component";
import { KAART_CFG, KaartConfig } from "./kaart-config";
import { ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import { KaartComponent } from "./kaart.component";
import { KaartLoadingComponent } from "./loading/kaart-loading.component";
import { MarkeerKaartklikComponent } from "./markeer-kaartklik/markeer-kaartklik.component";
import { KaartMetenComponent } from "./meten/kaart-meten.component";
import { KaartMultiMetenComponent } from "./meten/kaart-multi-meten.component";
import { KaartMijnLocatieComponent } from "./mijn-locatie/kaart-mijn-locatie.component";
import { KaartMijnMobieleLocatieComponent } from "./mijn-locatie/kaart-mijn-mobiele-locatie.component";
import { KaartOpenStreetViewComponent } from "./open-street-view/kaart-open-street-view.component";
import { KaartRotatieComponent } from "./rotatie/kaart-rotatie.component";
import { KaartSchaalComponent } from "./schaal/kaart-schaal.component";
import { StijleditorModule } from "./stijleditor/index";
import { KaartMultiTekenLaagComponent } from "./tekenen/kaart-multi-teken-laag.component";
import { KaartTekenLaagComponent } from "./tekenen/kaart-teken-laag.component";
import { KaartVoorwaardenComponent } from "./voorwaarden/kaart-voorwaarden.component";
import { KaartZoomComponent } from "./zoom/kaart-zoom.component";

const components: any[] = [
  KaartAchtergrondSelectorComponent,
  KaartAchtergrondTileComponent,
  KaartBevragenComponent,
  KaartComponent,
  KaartCopyrightComponent,
  KaartInfoBoodschapAlertComponent,
  KaartInfoBoodschapComponent,
  KaartInfoBoodschapIdentifyComponent,
  KaartInfoBoodschapKaartBevragenComponent,
  KaartInfoBoodschapMetenComponent,
  KaartInfoBoodschappenComponent,
  KaartInfoBoodschapVeldinfoComponent,
  MarkeerKaartklikComponent,
  KaartLoadingComponent,
  KaartMetenComponent,
  KaartMijnLocatieComponent,
  KaartMijnMobieleLocatieComponent,
  KaartMultiMetenComponent,
  KaartMultiTekenLaagComponent,
  KaartOpenLayersStyleComponent,
  KaartOpenStreetViewComponent,
  KaartRotatieComponent,
  KaartSchaalComponent,
  KaartTekenComponent,
  KaartTekenLaagComponent,
  KaartVoorwaardenComponent,
  KaartZoomComponent
];

// Weersta de drang om deze variabele in een andere module te plaatsen, want dat geeft problemen met gebruik in AOT app.
export const defaultKaartConfig: KaartConfig = {
  geoserver: {
    urls: ["/geoserver/wms"]
  },
  tilecache: {
    urls: ["/geowebcache/service/wms"]
  },
  orthofotomozaiek: {
    naam: "Ortho",
    urls: ["https://geoservices.informatievlaanderen.be/raadpleegdiensten/omwrgbmrvl/wms"]
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

/** Custom options the configure the tooltip's default show/hide delays. */
export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 750,
  hideDelay: 0,
  touchendHideDelay: 0
};

@NgModule({
  imports: [
    CommonModule,
    ClickOutsideModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatCardModule,
    MatInputModule,
    MatTooltipModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AbbameldaModule,
    ZoekerModule.forRoot({}),
    LagenkiezerModule.withDefaults(),
    StijleditorModule,
    FilterModule
  ],
  declarations: [components],
  exports: [components],
  providers: [ReplaySubjectKaartCmdDispatcher, { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults }]
})
export class KaartModule {
  static defaultConfig = defaultKaartConfig;

  static forRoot(config: KaartConfig): ModuleWithProviders {
    return {
      ngModule: KaartModule,
      providers: [{ provide: KAART_CFG, useValue: config }, ReplaySubjectKaartCmdDispatcher]
    };
  }

  static withDefaults(): ModuleWithProviders {
    return KaartModule.forRoot(KaartModule.defaultConfig);
  }
}

export * from "../coordinaten/coordinaten.service";
export * from "./copyright/kaart-copyright.component";
export * from "./info-boodschappen/kaart-info-boodschap-veldinfo.component";
export * from "./kaart-bevragen/kaart-bevragen.component";
export * from "./kaart-bevragen/laaginfo.model";
export * from "./kaart-component-base";
export * from "./kaart-elementen";
export * from "./kaart-event-dispatcher";
export * from "./kaart-legende";
export * from "./kaart-protocol";
export * from "./kaart.component";
export * from "./markeer-kaartklik/markeer-kaartklik.component";
export * from "./log";
export * from "./meten/kaart-meten.component";
export * from "./meten/kaart-multi-meten.component";
export * from "./mijn-locatie/kaart-mijn-locatie.component";
export * from "./mijn-locatie/kaart-mijn-mobiele-locatie.component";
export * from "./open-street-view/kaart-open-street-view.component";
export * from "./schaal/kaart-schaal.component";
export * from "./stijl-selector";
export * from "./styles";
export * from "./tekenen/kaart-multi-teken-laag.component";
export * from "./tekenen/kaart-teken-laag.component";
export * from "./voorwaarden/kaart-voorwaarden.component";
export * from "./zoom/kaart-zoom.component";
