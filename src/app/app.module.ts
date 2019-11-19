import { registerLocaleData } from "@angular/common";
import localeBe from "@angular/common/locales/nl-BE";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonToggleModule, MatDialogModule, MatSlideToggleModule } from "@angular/material";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { ClickOutsideModule } from "ng4-click-outside";
import { TransparantieeditorModule } from "projects/ng-kaart/src/lib/transparantieeditor";

import { ClassicModule, FilterModule, KaartModule, LagenkiezerModule, ZoekerModule } from "../../projects/ng-kaart/src/public_api";

import { AppComponent, routes } from "./app.component";
import { AvKaartInnerComponent } from "./av-kaart-inner.component";
import { AvKaartComponent } from "./av-kaart.component";
import { FeatureDemoComponent } from "./feature-demo.component";
import { PatKaartComponent } from "./pat-kaart.component";
import { PerceelPopupComponent } from "./perceel-popup/perceel-popup.component";
import { ProtractorComponent } from "./protractor.component";
import { TestSectieComponent } from "./test-sectie.component";

registerLocaleData(localeBe);

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
    KaartModule.withDefaults(),
    ClassicModule,
    FormsModule,
    MatDialogModule,
    RouterModule.forRoot(routes),
    ZoekerModule.forRoot({
      googleWdb: {
        apiKey: "AIzaSyApbXMl5DGL60g17JU6MazMxNcUGooey7I"
      }
    }),
    LagenkiezerModule.withDefaults(),
    // Deze lijkt niet te werken. Zie main.ts voor registratie
    // ServiceWorkerModule.register("ng-kaart/ng-kaart-service-worker.js", {
    //   enabled: true
    // }),
    FilterModule,
    TransparantieeditorModule,
    ClickOutsideModule
  ],
  providers: [],
  entryComponents: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
