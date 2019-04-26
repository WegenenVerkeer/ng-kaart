import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonToggleModule, MatDialogModule, MatSlideToggleModule } from "@angular/material";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { ClickOutsideModule } from "ng4-click-outside";

import {
  ClassicModule,
  FilterComponent,
  FilterModule,
  KaartConfig,
  KaartModule,
  LagenkiezerModule,
  ZoekerModule
} from "../../projects/ng-kaart/src/public_api";

import { AppComponent, routes } from "./app.component";
import { AvKaartInnerComponent } from "./av-kaart-inner.component";
import { AvKaartComponent } from "./av-kaart.component";
import { FeatureDemoComponent } from "./feature-demo.component";
import { PatKaartComponent } from "./pat-kaart.component";
import { PerceelPopupComponent } from "./perceel-popup/perceel-popup.component";
import { ProtractorComponent } from "./protractor.component";
import { TestSectieComponent } from "./test-sectie.component";

export const kaartConfig: KaartConfig = {
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
    style: (null as any) as ol.style.Style,
    bevragenZoekRadius: {
      type: "Pixel",
      waarde: 64
    }
  }
};

@NgModule({
  declarations: [
    AppComponent,
    AvKaartComponent,
    AvKaartInnerComponent,
    FeatureDemoComponent,
    PatKaartComponent,
    PerceelPopupComponent,
    ProtractorComponent,
    TestSectieComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    KaartModule.forRoot(kaartConfig),
    ClassicModule,
    FormsModule,
    MatDialogModule,
    RouterModule.forRoot(routes),
    ZoekerModule.forRoot({
      googleWdb: {
        apiKey: "AIzaSyApbXMl5DGL60g17JU6MazMxNcUGooey7I"
      }
    }),
    FilterModule,
    LagenkiezerModule.withDefaults(),
    // Deze lijkt niet te werken. Zie main.ts voor registratie
    // ServiceWorkerModule.register("ng-kaart/ng-kaart-service-worker.js", {
    //   enabled: true
    // }),
    ClickOutsideModule
  ],
  providers: [],
  entryComponents: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
