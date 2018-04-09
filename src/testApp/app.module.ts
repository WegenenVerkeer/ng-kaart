import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { KaartModule } from "../lib/kaart/index";
import { AppComponent } from "./app.component";
import { FormsModule } from "@angular/forms";
import { ZoekerModule } from "../lib/zoeker/index";
import { HttpModule } from "@angular/http";
import { ClickOutsideModule } from "ng4-click-outside";
import { AvKaartComponent } from "./av-kaart.component";
import { AvKaartInnerComponent } from "./av-kaart-inner.component";

@NgModule({
  declarations: [AppComponent, AvKaartComponent, AvKaartInnerComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    KaartModule.withDefaults(),
    FormsModule,
    ZoekerModule.forRoot({
      // ssh tunnel naar apigateway van dev - ssh -L 5100:apigateway.dev.awv.internal:80 management.apps.mow.vlaanderen.be
      url: "http://localhost:5100/locatiezoeker"
    }),
    ClickOutsideModule,
    HttpModule
  ],
  providers: [],
  entryComponents: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
