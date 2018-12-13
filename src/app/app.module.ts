import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { ClickOutsideModule } from "ng4-click-outside";

import { ClassicModule, KaartModule, LagenkiezerModule, ZoekerModule } from "@wegenenverkeer/ng-kaart";

import { AppComponent, routes } from "./app.component";
import { AvKaartInnerComponent } from "./av-kaart-inner.component";
import { AvKaartComponent } from "./av-kaart.component";
import { FeatureDemoComponent } from "./feature-demo.component";
import { PatKaartComponent } from "./pat-kaart.component";
import { PerceelPopupComponent } from "./perceel-popup/perceel-popup.component";
import { ProtractorComponent } from "./protractor.component";
import { TestSectieComponent } from "./test-sectie.component";

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
    KaartModule.withDefaults(),
    ClassicModule,
    FormsModule,
    RouterModule.forRoot(routes),
    ZoekerModule.forRoot({
      googleWdb: {
        apiKey: "AIzaSyApbXMl5DGL60g17JU6MazMxNcUGooey7I"
      }
    }),
    LagenkiezerModule.withDefaults(),
    ClickOutsideModule
  ],
  providers: [],
  entryComponents: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
