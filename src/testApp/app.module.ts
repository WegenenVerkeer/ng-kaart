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

@NgModule({
  declarations: [AppComponent, AvKaartComponent, AvKaartInnerComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    KaartModule.withDefaults(),
    ClassicModule,
    FormsModule,
    ZoekerModule.forRoot({
      googleWdb: {
        url: "http://localhost:5100/locatiezoeker",
        apiKey: "AIzaSyApbXMl5DGL60g17JU6MazMxNcUGooey7I"
      },
      crab: {
        url: "http://localhost:5101/locatorservices"
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
