import { Injector, NgModule } from "@angular/core";
import { createCustomElement } from "@angular/elements";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ClickOutsideModule } from "ng4-click-outside";

import { ClassicModule, componentMap, KaartClassicComponent } from "../../../ng-kaart/src/lib/classic";
import { KaartModule } from "../../../ng-kaart/src/lib/kaart";
import { LagenkiezerModule } from "../../../ng-kaart/src/lib/lagenkiezer";
import { ZoekerModule } from "../../../ng-kaart/src/lib/zoeker";

import { KaartElementComponent } from "./kaart-element/kaart-element.component";

@NgModule({
  declarations: [KaartElementComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    KaartModule.withDefaults(),
    ClassicModule,
    ZoekerModule.forRoot({
      googleWdb: {
        apiKey: "AIzaSyApbXMl5DGL60g17JU6MazMxNcUGooey7I"
      }
    }),
    LagenkiezerModule.withDefaults(),
    ClickOutsideModule
  ],
  entryComponents: [KaartElementComponent]
})
export class AppModule {
  public constructor(injector: Injector) {
    // Pas op!!! De volgorde is heel belangrijk hier. De kaart moet eerst zijn.
    customElements.define("awv-kaart-element", createCustomElement(KaartElementComponent, { injector }));
    Object.keys(componentMap).forEach(tag => customElements.define(tag, createCustomElement(componentMap[tag], { injector })));
  }

  ngDoBootstrap() {}
}
