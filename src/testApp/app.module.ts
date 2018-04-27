import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpModule } from "@angular/http";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ClickOutsideModule } from "ng4-click-outside";

import { KaartModule } from "../lib/kaart/index";
import { LagenkiezerModule } from "../lib/lagenkiezer";
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
    FormsModule,
    ZoekerModule.forRoot({
      url: "http://localhost:5100/locatiezoeker",
      apiKey: "AIzaSyApbXMl5DGL60g17JU6MazMxNcUGooey7I"
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
