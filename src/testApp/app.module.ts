import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpModule } from "@angular/http";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ClickOutsideModule } from "ng4-click-outside";

import { ClassicModule } from "../lib/classic";
import { KaartModule } from "../lib/kaart/index";
import { LagenkiezerModule } from "../lib/lagenkiezer/index";
import { ZoekerModule } from "../lib/zoeker/index";

import { AppComponent } from "./app.component";
import { AvKaartInnerComponent } from "./av-kaart-inner.component";
import { AvKaartComponent } from "./av-kaart.component";
import { PatKaartComponent } from "./pat-kaart.component";
import { PerceelPopupComponent } from "./perceel-popup/perceel-popup.component";
import { TestSectieComponent } from "./test-sectie.component";

@NgModule({
  declarations: [AppComponent, AvKaartComponent, AvKaartInnerComponent, PatKaartComponent, PerceelPopupComponent, TestSectieComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    KaartModule.withDefaults(),
    ClassicModule,
    FormsModule,
    ZoekerModule.forRoot({
      googleWdb: {
        url: "/locatiezoeker",
        apiKey: "AIzaSyApbXMl5DGL60g17JU6MazMxNcUGooey7I"
      },
      locatorServices: {
        url: "/locatorservices"
      }
    }),
    LagenkiezerModule.withDefaults(),
    ClickOutsideModule,
    HttpModule
  ],
  providers: [],
  entryComponents: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
